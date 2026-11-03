import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import type { Readable } from "node:stream";
import zlib from "node:zlib";
import { BlockedAddressError, isPrivateIp, parsePublicUrl, siteKey } from "./net-safety";
import { CRAWLER_NAME } from "./robots";

// Fetches one web page for the site reader. Every address the name resolves to is
// checked at connection time (so a name that changes its answer cannot slip past),
// redirects are followed by hand and must stay on the same site, and size and time
// are capped.

export const USER_AGENT = `${CRAWLER_NAME}/1.0`;
const MAX_REDIRECTS = 3;
// `timeout` below is only an idle timeout (a server that trickles bytes can keep a socket open forever),
// so every request also gets a hard limit on its total time.
const TOTAL_TIMEOUT_MS = 20_000;

export class FetchFailedError extends Error {
  constructor(message = "The page could not be fetched.") {
    super(message);
    this.name = "FetchFailedError";
  }
}

export interface RawResponse {
  status: number;
  location: string | null;
  wrongType: boolean;
  body: string;
}
export interface FetchedPage {
  url: URL;
  status: number;
  wrongType: boolean;
  body: string;
}
export interface FetchOptions {
  maxBytes: number;
  timeoutMs: number;
  accept: string[]; // content types worth reading, e.g. ["text/html"]
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

// Used as the `lookup` of the connection: resolve, then refuse private addresses.
export function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, "");
    if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
      return callback(new BlockedAddressError() as NodeJS.ErrnoException, "");
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

function request(url: URL, options: FetchOptions): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    // Node skips the name lookup for a raw IP address, so the guard below would never run.
    // We only read websites by name; refuse any address typed as numbers.
    if (isIP(url.hostname.replace(/^\[|\]$/g, ""))) return reject(new BlockedAddressError());
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        timeout: options.timeoutMs,
        signal: AbortSignal.timeout(TOTAL_TIMEOUT_MS),
        lookup: guardedLookup as never,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.1",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        // We never need the body of a redirect or of a page we will not read: close the connection
        // instead of draining it, so a site cannot stream us bytes the size cap would not see.
        if (status >= 300 && status < 400) {
          res.destroy();
          return finish(() => resolve({ status, location: String(res.headers.location ?? "") || null, wrongType: false, body: "" }));
        }
        const type = String(res.headers["content-type"] ?? "").toLowerCase();
        if (!options.accept.some((a) => type.includes(a))) {
          res.destroy();
          return finish(() => resolve({ status, location: null, wrongType: true, body: "" }));
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: Readable = res;
        if (encoding === "gzip") stream = res.pipe(zlib.createGunzip());
        else if (encoding === "br") stream = res.pipe(zlib.createBrotliDecompress());
        else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
        else if (encoding && encoding !== "identity") {
          res.destroy();
          return finish(() => reject(new FetchFailedError()));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        const done = () => finish(() => resolve({ status, location: null, wrongType: false, body: Buffer.concat(chunks).toString("utf8") }));
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            chunks.push(chunk.subarray(0, chunk.length - (size - options.maxBytes)));
            done();
            req.destroy();
          } else {
            chunks.push(chunk);
          }
        });
        stream.on("end", done);
        stream.on("error", () => finish(() => reject(new FetchFailedError())));
        res.on("error", () => finish(() => reject(new FetchFailedError())));
      },
    );
    req.on("timeout", () => req.destroy(new FetchFailedError("The website took too long to answer.")));
    req.on("error", (error) => finish(() => reject(error instanceof BlockedAddressError ? error : new FetchFailedError())));
    req.end();
  });
}

export async function fetchPublic(start: URL, options: FetchOptions): Promise<FetchedPage> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await request(current, options);
    if (response.status >= 300 && response.status < 400 && response.location) {
      let next: URL | null = null;
      try {
        next = parsePublicUrl(new URL(response.location, current).toString());
      } catch {
        next = null;
      }
      if (!next) throw new BlockedAddressError();
      if (siteKey(next.hostname) !== siteKey(start.hostname)) throw new FetchFailedError("The page moved to another website.");
      current = next;
      continue;
    }
    return { url: current, status: response.status, wrongType: response.wrongType, body: response.body };
  }
  throw new FetchFailedError("Too many redirects.");
}

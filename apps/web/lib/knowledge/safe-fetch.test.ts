import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BlockedAddressError } from "./net-safety";
import { fetchPublic, guardedLookup } from "./safe-fetch";

const OPTIONS = { maxBytes: 100_000, timeoutMs: 3000, accept: ["text/html"] };
let server: http.Server;
let port: number;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.setHeader("content-type", "text/html");
    res.end("<p>secret internal page</p>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("guardedLookup", () => {
  it("refuses a name that points at a private address", async () => {
    const result = await new Promise<unknown>((resolve) => guardedLookup("localhost", {}, (err) => resolve(err)));
    expect(result).toBeInstanceOf(BlockedAddressError);
  });
});

describe("fetchPublic", () => {
  it("will not connect to a private address, even when the address is typed in directly", async () => {
    // parsePublicUrl already refuses these; this proves the connection layer does too.
    await expect(fetchPublic(new URL(`http://localhost:${port}/`), OPTIONS)).rejects.toBeInstanceOf(BlockedAddressError);
    await expect(fetchPublic(new URL(`http://127.0.0.1:${port}/`), OPTIONS)).rejects.toBeInstanceOf(BlockedAddressError);
  });
});

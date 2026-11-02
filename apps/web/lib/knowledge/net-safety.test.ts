import { describe, expect, it } from "vitest";
import { isPrivateIp, parsePublicUrl, siteKey } from "./net-safety";

describe("isPrivateIp", () => {
  it("blocks private, loopback, link-local and reserved IPv4", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1", "255.255.255.255", "198.18.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it("allows ordinary public IPv4", () => {
    for (const ip of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "11.0.0.1"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
  it("blocks private IPv6, including IPv4-mapped forms", () => {
    for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "2001:db8::1", "64:ff9b::1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it("allows public IPv6", () => {
    for (const ip of ["2606:4700:4700::1111", "2a00:1450:4001:81b::200e", "::ffff:8.8.8.8"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
  it("treats anything that is not an IP as private", () => {
    for (const ip of ["", "example.com", "999.1.1.1", "1.2.3", "::gggg"]) expect(isPrivateIp(ip), ip).toBe(true);
  });
});

describe("parsePublicUrl", () => {
  it("accepts a website address and adds https when missing", () => {
    expect(parsePublicUrl("example.com")?.toString()).toBe("https://example.com/");
    expect(parsePublicUrl("  http://www.Example.com/about#team ")?.toString()).toBe("http://www.example.com/about");
    expect(parsePublicUrl("https://shop.example.co.uk:443/x")?.hostname).toBe("shop.example.co.uk");
  });
  it("refuses other schemes, logins, odd ports and IP addresses", () => {
    for (const bad of [
      "ftp://example.com", "file:///etc/passwd", "javascript:alert(1)", "https://user:pw@example.com", "https://example.com:8080",
      "http://127.0.0.1", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://2130706433/", "http://0x7f.0.0.1/",
      "http://localhost", "http://app.internal", "http://printer.local", "http://nodot", "https://", "", "x".repeat(3000),
    ]) {
      expect(parsePublicUrl(bad), bad).toBeNull();
    }
  });
});

describe("siteKey", () => {
  it("treats www and the bare domain as one site", () => {
    expect(siteKey("WWW.Example.com")).toBe("example.com");
    expect(siteKey("shop.example.com")).toBe("shop.example.com");
  });
});

// Rules for which addresses the Wiki builder may read. No I/O, so it can be tested without a network.
// The builder fetches pages a person typed in, from our server, so it must never be talked into reading something inside our own
// network (a database host, a cloud metadata address, localhost). Names are checked here; the addresses they resolve to are
// checked again by `isPrivateIp` at connection time (see lib/hub/web.ts), which is what stops a name that points inside.

import { isIP } from "node:net";

/** True for any address that is not an ordinary public internet address (private, loopback, link-local, multicast, documentation, carrier-grade NAT, transition ranges). */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b, c] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    return false;
  }
  if (v === 6) {
    let host: string;
    try {
      host = new URL(`http://[${ip}]/`).hostname.slice(1, -1).toLowerCase();
    } catch {
      return true;
    }
    if (host === "::" || host === "::1") return true;
    const mapped = /^::ffff:(.+)$/.exec(host);
    if (mapped) {
      const m = mapped[1];
      if (m.includes(".")) return isPrivateIp(m);
      const [hi, lo] = m.split(":").map((x) => parseInt(x, 16));
      if (Number.isNaN(hi) || Number.isNaN(lo)) return true;
      return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(host.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    if (host.startsWith("64:ff9b:") || host.startsWith("2002:") || host.startsWith("2001:0:") || host.startsWith("2001:db8:") || host.startsWith("100:")) return true;
    return false;
  }
  return true; // not an address at all
}

const BAD_SUFFIX = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet", ".test", ".invalid", ".example"];

/** A web address a person typed: "brand.com", "https://brand.com/about". Only public http(s) sites on the normal ports pass. */
export function checkUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text || text.length > 300) return { ok: false, error: "That web address is empty or too long." };
  if (/\s/.test(text)) return { ok: false, error: "A web address has no spaces." };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: "That does not look like a web address." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "Only http and https addresses can be read." };
  if (url.username || url.password) return { ok: false, error: "Leave sign-in details out of the address." };
  if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, error: "Only normal web ports can be read." };
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) return { ok: false, error: "That address is not a public website." };
  } else if (host === "localhost" || !host.includes(".") || BAD_SUFFIX.some((s) => host.endsWith(s)) || host.length > 253) {
    return { ok: false, error: "That is not a public website address." };
  }
  url.hash = "";
  return { ok: true, url };
}

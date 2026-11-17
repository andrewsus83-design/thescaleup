// Hides most of an email address or phone number for people who may see a lead or client but not their contact details.
// This keeps contact details from being read off a screen, copied or screenshotted in bulk. It is not a lock: the first and
// last characters stay, which is what lets someone tell two people apart.

const DOT = "•";

/** `ana.maria@gmail.com` becomes `a•••@gmail.com`. Anything that is not an address is hidden whole. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (!email || at < 1 || at === email.length - 1) return email ? DOT.repeat(3) : "";
  return `${email[0]}${DOT.repeat(3)}${email.slice(at)}`;
}

/** `081234567890` becomes `0812••••••90`: the first four and the last two characters stay. Short numbers keep less. */
export function maskPhone(phone: string): string {
  const p = phone.trim();
  if (!p) return "";
  const chars = [...p];
  if (chars.length >= 9) return `${chars.slice(0, 4).join("")}${DOT.repeat(chars.length - 6)}${chars.slice(-2).join("")}`;
  if (chars.length >= 5) return `${chars.slice(0, 2).join("")}${DOT.repeat(chars.length - 3)}${chars.slice(-1).join("")}`;
  return DOT.repeat(3);
}

/** The same person with the contact details hidden. */
export function maskContacts<T extends { email: string; phone: string }>(p: T): T {
  return { ...p, email: maskEmail(p.email), phone: maskPhone(p.phone) };
}

import { DM_Sans, Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";

/**
 * All41 four-font system, loaded only by /hub.
 * Title / Body / Mono / Accent correspond to the public All41 identity.
 */
export const all41Title = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-all41-title",
  display: "swap",
});
export const all41Body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-all41-body",
  display: "swap",
});
export const all41Mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-all41-mono",
  display: "swap",
});
export const all41Accent = Fraunces({
  subsets: ["latin"],
  variable: "--font-all41-accent",
  display: "swap",
});
export const all41FontVariables = [
  all41Title.variable,
  all41Body.variable,
  all41Mono.variable,
  all41Accent.variable,
].join(" ");

import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

// Brand v2 type (BRAND.md §4): Bricolage Grotesque for titles, Instrument Sans for reading. JetBrains Mono for commands, numbers and
// caps labels is already loaded by the root layout (--font-jbmono). Loaded once here and applied by the layouts that use the
// brand look (app/room, the admin login), so the rest of the site doesn't download them.
export const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], variable: "--font-bricolage", display: "swap" });
export const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });

import { bricolage, instrument } from "@/lib/brand-fonts";

// The login wears the brand v2 look (light, Bricolage + Instrument Sans), like the Chat Room it leads to.
export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${bricolage.variable} ${instrument.variable}`}>{children}</div>;
}

import type { Metadata, Viewport } from "next";
import { all41FontVariables } from "@/lib/all41-fonts";
import "./all41-hub.css";

export const metadata: Metadata = {
  title: { default: "All41 Hub", template: "%s · All41" },
  robots: { index: false, follow: false },
};

// viewport-fit=cover lets the bottom bar sit above the home indicator (env(safe-area-inset-bottom)) on iPhones and installed apps.
export const viewport: Viewport = { viewportFit: "cover" };

/** The brand app (founders, ops and agency staff). Paints its own paper surface like the Room does. */
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${all41FontVariables} room-app all41-hub fixed inset-0 z-10 overflow-y-auto bg-paper-100 font-text text-body text-ink-800 antialiased`}>
      {children}
    </div>
  );
}

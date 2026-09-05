import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Logo } from "./logo";
import { nav, site } from "@/lib/site";

const columns = [
  {
    title: "Platform",
    links: [
      { label: "Cara Kerja", href: "/cara-kerja" },
      { label: "Executive Board", href: "/executive-board" },
      { label: "Harga", href: "/#harga" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Perusahaan",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Dashboard Klien", href: "/dashboard" },
      { label: "Mulai Audit", href: "/mulai" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer
      id="footer"
      className="relative border-t border-white/8 bg-surface/50 pt-16"
    >
      <Container>
        <div className="grid gap-10 pb-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              {site.tagline}. Audit bisnis berbasis AI yang menemukan kebocoran
              omzet Anda dan menyerahkan roadmap scale-up yang siap dieksekusi.
            </p>
            <a
              href={`mailto:${site.email}`}
              className="mt-4 inline-block font-mono text-sm text-coral hover:underline"
            >
              {site.email}
            </a>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-display text-sm font-bold text-mist">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-slate-400 transition-colors hover:text-coral"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/8 py-7 sm:flex-row">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} {site.name}. Dibuat untuk bisnis yang
            siap naik kelas.
          </p>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-xs text-slate-500 transition-colors hover:text-slate-300"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}

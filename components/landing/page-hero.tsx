import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

export function PageHero({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-hero-glow pb-6 pt-28 sm:pt-36">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines [mask-image:radial-gradient(60%_60%_at_50%_30%,#000,transparent)]" />
      <Container className="relative text-center">
        <Badge>{badge}</Badge>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-mist sm:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
            {subtitle}
          </p>
        )}
      </Container>
    </section>
  );
}

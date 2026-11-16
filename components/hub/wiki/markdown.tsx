import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Wiki text is Markdown. react-markdown builds React elements and never inserts raw HTML, so a page cannot carry a script.
// Images are left out for now (a remote image would tell its host who opened the page); their alt text shows instead.

const parts: Components = {
  h1: ({ children }) => <h2 className="mt-10 font-title text-h3 text-ink-800 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-8 font-title text-h4 text-ink-800 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-6 text-body font-semibold text-ink-800 first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-4 text-body font-semibold text-ink-800 first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="text-pretty text-body leading-relaxed text-ink-800">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-6 text-body text-ink-800">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6 text-body text-ink-800">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-hairline pl-4 text-ink-500">{children}</blockquote>,
  hr: () => <hr className="border-hairline" />,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children, className }) => (className ? <code className={className}>{children}</code> : <code className="rounded bg-paper-100 px-1.5 py-0.5 font-mono text-small">{children}</code>),
  pre: ({ children }) => <pre className="overflow-x-auto rounded-field bg-paper-100 p-4 font-mono text-small text-ink-800">{children}</pre>,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-small">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-hairline px-3 py-2 font-semibold text-ink-800">{children}</th>,
  td: ({ children }) => <td className="border-b border-hairline px-3 py-2 text-ink-800">{children}</td>,
  a: ({ href, children }) => {
    const to = href ?? "";
    // A link the renderer refused (a javascript: address, say) comes through empty: show its words without a link.
    if (!to) return <span>{children}</span>;
    // "/path" stays inside the hub. "//host" is another site, so it takes the external branch below.
    if (to.startsWith("/") && !to.startsWith("//")) return <Link href={to} className="font-semibold text-brand-700 underline underline-offset-4">{children}</Link>;
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline underline-offset-4">
        {children}
      </a>
    );
  },
};

export function Markdown({ text }: { text: string }) {
  if (!text.trim()) return <p className="text-body text-ink-500">This page has no text yet.</p>;
  return (
    <div className="space-y-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={parts} disallowedElements={["img"]} unwrapDisallowed>
        {text}
      </ReactMarkdown>
    </div>
  );
}

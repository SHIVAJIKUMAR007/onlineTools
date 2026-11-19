import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Breadcrumbs, FaqList } from "@/components/Content";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolCard } from "@/components/tools/ToolCard";
import { Alert, Spinner } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { categoryById } from "@/data/categories";
import { relatedTools, type ToolMeta } from "@/data/tools";
import { toolComponent } from "@/tools/registry";

class ToolErrorBoundary extends Component<{ children: ReactNode; name: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const chunkFailed = /dynamically imported module|Failed to fetch|Loading chunk/i.test(this.state.error.message);
    return (
      <Alert tone="danger" title={`${this.props.name} stopped working`}>
        <p>
          {chunkFailed
            ? "The code for this tool could not be loaded. Check your connection and reload the page."
            : "Something unexpected went wrong with this file. Your files were not uploaded anywhere. Reload the page and try again, or try a different file."}
        </p>
        <Button className="mt-3" size="sm" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </Alert>
    );
  }
}

export default function ToolPage({ tool }: { tool: ToolMeta }) {
  const Tool = toolComponent(tool.id);
  const cat = categoryById(tool.category);
  const related = relatedTools(tool);
  return (
    <article className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <Breadcrumbs items={[{ name: cat.name, to: `/${cat.slug}` }, { name: tool.name }]} />
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">{tool.h1}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{tool.intro}</p>
        <PrivacyNotice className="mt-4" />
      </header>

      <section aria-label={`${tool.name} tool`} className="mt-8">
        {Tool ? (
          <ToolErrorBoundary name={tool.name} key={tool.id}>
            <Suspense
              fallback={
                <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted" role="status">
                  <Spinner /> Loading {tool.name}…
                </div>
              }
            >
              <Tool />
            </Suspense>
          </ToolErrorBoundary>
        ) : (
          <Alert tone="warn" title="This tool is not available">
            It could not be found. Browse the{" "}
            <Link to="/tools" className="underline">
              full list of tools
            </Link>
            .
          </Alert>
        )}
      </section>

      <div className="mt-16 grid gap-12 md:grid-cols-2">
        <section aria-labelledby="how-h">
          <h2 id="how-h" className="text-xl font-semibold">
            How to use {tool.name}
          </h2>
          <ol className="mt-4 space-y-3">
            {tool.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                <span className="tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="feat-h">
          <h2 id="feat-h" className="text-xl font-semibold">
            Features
          </h2>
          <ul className="mt-4 space-y-2.5 text-[15px] text-ink-2">
            {tool.features.map((f) => (
              <li key={f} className="flex gap-2.5 leading-relaxed">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-16" aria-labelledby="faq-h">
        <h2 id="faq-h" className="mb-5 text-xl font-semibold">
          Frequently asked questions
        </h2>
        <FaqList faqs={tool.faqs} />
      </section>

      <section className="mt-16" aria-labelledby="rel-h">
        <h2 id="rel-h" className="mb-5 text-xl font-semibold">
          Related tools
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((t) => (
            <li key={t.id}>
              <ToolCard tool={t} />
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-16" aria-labelledby="article-h">
        <h2 id="article-h" className="text-2xl font-semibold">
          {tool.article.title}
        </h2>
        <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink-2">
          {tool.article.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
    </article>
  );
}

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Breadcrumbs } from '@/components/Content'
import { blogPostBySlug, blogPosts, blogReadingTime } from '@/data/blog'
import NotFound from '@/pages/NotFound'

export default function BlogPostPage() {
  const { slug = '' } = useParams()
  const post = blogPostBySlug(slug)

  if (!post) return <NotFound />

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs items={[{ name: 'Blog', to: '/blog' }, { name: post.title }]} />
        <article>
          <header>
            <p className="text-sm font-medium text-accent">Stayput guides</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{post.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">{post.excerpt}</p>
            <p className="mt-4 text-sm text-muted">
              <time dateTime={post.publishedAt}>{post.publishedLabel}</time>
              <span aria-hidden="true"> · </span>
              {blogReadingTime(post)} min read
            </p>
          </header>

          <img
            src={post.image}
            alt={post.imageAlt}
            width="1200"
            height="675"
            fetchPriority="high"
            decoding="async"
            className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover"
          />

          <div className="prose-plain mx-auto mt-10 max-w-2xl text-[16px] leading-8 text-ink-2">
            {post.sections.map((section) => (
              <section key={section.heading} className="mt-9 first:mt-0">
                <h2 className="mb-3 text-2xl font-semibold leading-snug text-ink">{section.heading}</h2>
                {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-accent-line bg-accent-tint p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <h2 className="text-lg font-semibold">{post.toolCta}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">Process your content locally in your browser.</p>
            </div>
            <Link
              to={`/${post.toolSlug}`}
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-offset-4 sm:mt-0"
            >
              Open tool <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </article>

        <Link to="/blog" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          All guides
        </Link>

        <nav aria-label="More guides" className="mt-12 border-t border-line pt-8">
          <h2 className="text-lg font-semibold">More guides</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {blogPosts.filter((item) => item.slug !== post.slug).map((item) => (
              <li key={item.slug}>
                <Link
                  to={`/blog/${item.slug}`}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm font-medium hover:border-accent-line hover:text-accent"
                >
                  {item.title}
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}

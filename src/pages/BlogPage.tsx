import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Breadcrumbs } from '@/components/Content'
import { blogPosts, blogReadingTime } from '@/data/blog'

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Breadcrumbs items={[{ name: 'Blog' }]} />
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-accent">Stayput guides</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Practical guides for everyday files</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          Clear advice for working with images, PDFs and developer data, with useful limits and checks included.
        </p>
      </header>

      <section aria-label="Blog articles" className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {blogPosts.map((post) => (
          <article key={post.slug} className="overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
            <Link to={`/blog/${post.slug}`} className="group block">
              <img
                src={post.image}
                alt={post.imageAlt}
                width="1200"
                height="675"
                loading="lazy"
                decoding="async"
                className="aspect-[16/9] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <div className="p-5">
                <p className="text-sm text-muted">
                  <time dateTime={post.publishedAt}>{post.publishedLabel}</time>
                  <span aria-hidden="true"> · </span>
                  {blogReadingTime(post)} min read
                </p>
                <h2 className="mt-3 text-xl font-semibold leading-snug text-ink group-hover:text-accent">{post.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{post.excerpt}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent">
                  Read the guide <ArrowRight className="size-4" aria-hidden />
                </span>
              </div>
            </Link>
          </article>
        ))}
      </section>
    </div>
  )
}

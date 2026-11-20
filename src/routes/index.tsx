import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { categories } from '@/data/categories'
import { aboutPage, contactPage, disclaimerPage, privacyPage, termsPage } from '@/data/pages'
import { tools } from '@/data/tools'
import Home from '@/pages/Home'
import { AllTools, CategoryPage } from '@/pages/Listing'
import NotFound from '@/pages/NotFound'

// Tool pages and legal pages load on demand.
const ToolPage = lazy(() => import('@/pages/ToolPage'))
const DocPageView = lazy(() => import('@/pages/DocPageView'))
const BlogPage = lazy(() => import('@/pages/BlogPage'))
const BlogPostPage = lazy(() => import('@/pages/BlogPostPage'))

/** Every route comes from the registry, so nothing in the navigation can point at a missing page. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="tools" element={<AllTools />} />
        <Route path="blog" element={<BlogPage />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />
        {categories.map((c) => (
          <Route key={c.id} path={c.slug} element={<CategoryPage slug={c.slug} />} />
        ))}
        {tools.map((t) => (
          <Route key={t.id} path={t.slug} element={<ToolPage tool={t} />} />
        ))}
        <Route path="about" element={<DocPageView page={aboutPage} />} />
        <Route path="privacy" element={<DocPageView page={privacyPage} />} />
        <Route path="terms" element={<DocPageView page={termsPage} />} />
        <Route path="disclaimer" element={<DocPageView page={disclaimerPage} />} />
        <Route path="contact" element={<DocPageView page={contactPage} />} />
        <Route path="*"element={<NotFound />} />
      </Route>
    </Routes>
  )
}

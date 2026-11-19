import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-6xl font-semibold tracking-tight text-accent">404</p>
      <h1 className="mt-4 text-2xl font-semibold">That page does not exist</h1>
      <p className="mt-2 text-ink-2">The link may be old or mistyped. Search for a tool, or browse the full list.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/tools" className={cn(buttonVariants({ variant: 'primary' }))}>Browse all tools</Link>
        <Link to="/" className={cn(buttonVariants({ variant: 'secondary' }))}>Go home</Link>
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { toolPath, type ToolMeta } from '@/data/tools'
import { cn } from '@/lib/utils/cn'

export function ToolCard({ tool, className, showCategory }: { tool: ToolMeta; className?: string; showCategory?: boolean }) {
  void showCategory
  return (
    <Link
      to={toolPath(tool)}
      className={cn(
        'group flex h-full flex-col gap-3 rounded-[14px] border border-line bg-paper p-4 transition-[border-color,box-shadow] duration-150 hover:border-accent/50 hover:shadow-lift focus-visible:outline-2',
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-accent-tint text-accent transition-colors group-hover:bg-accent group-hover:text-white">
        <Icon name={tool.icon} className="size-5" />
      </span>
      <span>
        <span className="block text-[15px] font-semibold tracking-tight text-ink">{tool.name}</span>
        <span className="mt-1 block text-sm leading-snug text-muted">{tool.description}</span>
      </span>
    </Link>
  )
}

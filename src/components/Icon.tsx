import {
  AlignLeft, ArrowDownUp, ArrowLeftRight, Binary, Braces, CaseSensitive, Code2, Combine, Crop, FileArchive, FileCode, FileImage, FileMinus,
  FilePlus2, FileText, Fingerprint, GitCompare, Hash, Image, Images, Info, KeyRound, Link, ListX, Minimize2, Palette, Repeat2, RotateCw,
  ScanSearch, Scaling, Scissors, Shapes, Smartphone, Table, Type, Wand2, Wrench, type LucideProps,
} from 'lucide-react'
import type { ComponentType } from 'react'

const icons: Record<string, ComponentType<LucideProps>> = {
  AlignLeft, ArrowDownUp, ArrowLeftRight, Binary, Braces, CaseSensitive, Code2, Combine, Crop, FileArchive, FileCode, FileImage, FileMinus,
  FilePlus2, FileText, Fingerprint, GitCompare, Hash, Image, Images, Info, KeyRound, Link, ListX, Minimize2, Palette, Repeat2, RotateCw,
  ScanSearch, Scaling, Scissors, Shapes, Smartphone, Table, Type, Wand2,
}

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = icons[name] ?? Wrench
  return <C aria-hidden="true" {...props} />
}

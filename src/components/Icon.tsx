import {
  AlignLeft, ArrowDownUp, Clock, ArrowLeftRight, Binary, Braces, CaseSensitive, Code2, Combine, Crop, FileArchive, FileCode, FileImage, FileMinus,
  FilePlus2, FileText, Fingerprint, GitCompare, Hash, Image, Images, Info, KeyRound, Link, ListX, Minimize2, Palette, Repeat2, RotateCw,
  ScanSearch, Scaling, Scissors, Shapes, Smartphone, Table, Type, Wand2, Wrench, Calculator, CalendarDays, CalendarClock, Timer, Hourglass, Percent, PiggyBank, Landmark, Receipt, Dices, Keyboard, MousePointerClick, Zap, Shuffle, Volume2, Lock, ShieldCheck, Database, FileJson, FileCode2, Terminal, Users, HeartPulse, GraduationCap, BriefcaseBusiness, Wallet, TrendingUp, BadgePercent, Banknote, Coins, Tag, CalendarPlus, CalendarCheck, Baseline, Sparkles, Languages, Eraser, FileSpreadsheet, Gauge, Monitor, Play, Scale, Fuel, Quote, ListOrdered, Activity, SlidersHorizontal, type LucideProps,
} from 'lucide-react'
import type { ComponentType } from 'react'

const icons: Record<string, ComponentType<LucideProps>> = {
  AlignLeft, ArrowDownUp, Clock, ArrowLeftRight, Binary, Braces, CaseSensitive, Code2, Combine, Crop, FileArchive, FileCode, FileImage, FileMinus,
  FilePlus2, FileText, Fingerprint, GitCompare, Hash, Image, Images, Info, KeyRound, Link, ListX, Minimize2, Palette, Repeat2, RotateCw,
  ScanSearch, Scaling, Scissors, Shapes, Smartphone, Table, Type, Wand2, Calculator, CalendarDays, CalendarClock, Timer, Hourglass, Percent, PiggyBank, Landmark, Receipt, Dices, Keyboard, MousePointerClick, Zap, Shuffle, Volume2, Lock, ShieldCheck, Database, FileJson, FileCode2, Terminal, Users, HeartPulse, GraduationCap, BriefcaseBusiness, Wallet, TrendingUp, BadgePercent, Banknote, Coins, Tag, CalendarPlus, CalendarCheck, Baseline, Sparkles, Languages, Eraser, FileSpreadsheet, Gauge, Monitor, Play, Scale, Fuel, Quote, ListOrdered, Activity, SlidersHorizontal,
}

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = icons[name] ?? Wrench
  return <C aria-hidden="true" {...props} />
}

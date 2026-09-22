import {
  BookOpen,
  Merge,
  Split,
  LayoutGrid,
  Image,
  Images,
  FileText,
  PenLine,
  Minimize2,
  Signature,
  ScanText,
  LockKeyhole,
} from "lucide-react";
const icons = {
  book: BookOpen,
  merge: Merge,
  split: Split,
  grid: LayoutGrid,
  image: Image,
  images: Images,
  file: FileText,
  pen: PenLine,
  compress: Minimize2,
  sign: Signature,
  scan: ScanText,
  lock: LockKeyhole,
};
export function ToolIcon({ name, size = 24 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons] ?? FileText;
  return <Icon size={size} strokeWidth={1.7} aria-hidden />;
}

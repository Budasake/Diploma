import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** "← Back to …" link shown at the top of inner pages. */
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> {label}
    </Link>
  );
}

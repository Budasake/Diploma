import Link from "next/link";
import { GraduationCap } from "lucide-react";

const links = [
  { href: "#features", label: "Боломжууд" },
  { href: "#how", label: "Хэрхэн ажилладаг" },
  { href: "#roles", label: "Хэрэглэгчид" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span>AI Туслах</span>
        </Link>

        <ul className="hidden gap-8 text-sm text-muted md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground sm:px-4"
          >
            Нэвтрэх
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover sm:px-4"
          >
            Бүртгүүлэх
          </Link>
        </div>
      </nav>
    </header>
  );
}

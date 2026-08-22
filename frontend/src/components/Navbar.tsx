"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/predict", label: "Predict" },
  { href: "/saved-routes", label: "Saved Routes" },
  { href: "/history", label: "History" },
];

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-surface/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-[72rem] items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-route text-white text-sm font-bold transition-transform group-hover:scale-105">
            CD
          </div>
          <span className="text-base font-bold tracking-tight text-ink hidden sm:inline">
            CommuteDelay
          </span>
        </Link>

        {/* Center nav links */}
        <ul className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`
                  px-3.5 py-2 rounded-lg text-sm font-medium no-underline transition-colors
                  ${
                    isActive(link.href)
                      ? "bg-accent-route-dim text-accent-route"
                      : "text-text-secondary hover:text-ink hover:bg-bg-page"
                  }
                `}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Auth buttons */}
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost text-sm">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-primary text-sm">
            Sign up
          </Link>
        </div>
      </nav>
    </header>
  );
}

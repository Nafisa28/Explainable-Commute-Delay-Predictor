"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/predict", label: "Predict" },
  { href: "/saved-routes", label: "Saved Routes" },
  { href: "/history", label: "History" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await signOut();
    setMenuOpen(false);
    router.push("/");
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const authControls = (compact: boolean) =>
    loading ? (
      <div className="h-8 w-20 bg-border/50 animate-pulse rounded-lg" />
    ) : user ? (
      <div className={`flex items-center gap-3 ${compact ? "flex-col w-full" : ""}`}>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-secondary bg-bg-page border border-border px-3 py-1.5 rounded-full font-medium max-w-[200px] truncate">
          <span className="live-pulse-dot shrink-0" />
          <span className="truncate">{user.email}</span>
        </div>
        {compact && (
          <div className="sm:hidden text-xs text-text-secondary w-full truncate px-1">
            {user.email}
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`btn btn-ghost text-xs sm:text-sm text-text-secondary hover:text-ink ${compact ? "w-full" : ""}`}
        >
          Log out
        </button>
      </div>
    ) : (
      <div className={`flex items-center gap-2 ${compact ? "flex-col w-full" : ""}`}>
        <Link
          href="/login"
          className={`btn btn-ghost text-sm ${compact ? "w-full" : ""}`}
          onClick={() => setMenuOpen(false)}
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className={`btn btn-primary text-sm ${compact ? "w-full" : ""}`}
          onClick={() => setMenuOpen(false)}
        >
          Sign up
        </Link>
      </div>
    );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-surface/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-[72rem] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 no-underline group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-route text-white text-sm font-bold transition-transform group-hover:scale-105">
            CD
          </div>
          <span className="text-base font-bold tracking-tight text-ink hidden sm:inline">
            CommuteDelay
          </span>
        </Link>

        <ul className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`
                  relative py-1.5 text-sm font-medium no-underline transition-colors duration-300 group
                  ${
                    isActive(link.href)
                      ? "text-accent-route"
                      : "text-text-secondary hover:text-ink"
                  }
                `}
              >
                <span>{link.label}</span>
                <span
                  className={`
                    absolute bottom-0 left-0 right-0 h-[2px] bg-accent-route origin-left scale-x-0 transition-transform duration-300 ease-out
                    group-hover:scale-x-100
                    ${isActive(link.href) ? "scale-x-100" : ""}
                  `}
                />
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3">{authControls(false)}</div>

        <button
          type="button"
          className="md:hidden touch-target inline-flex items-center justify-center rounded-lg text-ink hover:bg-bg-page"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          )}
        </button>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-t border-border bg-bg-surface px-4 py-4 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`touch-target flex items-center rounded-lg px-3 text-sm font-medium no-underline ${
                isActive(link.href) ? "text-accent-route bg-accent-route-dim" : "text-text-secondary"
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 mt-2 border-t border-border">{authControls(true)}</div>
        </div>
      )}
    </header>
  );
}

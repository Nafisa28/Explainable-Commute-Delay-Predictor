"use client";

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

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/");
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
                {/* Underline draw effect */}
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

        {/* Auth section */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-8 w-20 bg-border/50 animate-pulse rounded-lg" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-secondary bg-bg-page border border-border px-3 py-1.5 rounded-full font-medium max-w-[200px] truncate">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-ghost text-xs sm:text-sm text-text-secondary hover:text-ink"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn btn-ghost text-sm">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary text-sm">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

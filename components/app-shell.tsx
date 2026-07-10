import Link from "next/link";
import { Building2, Inbox, Rocket } from "lucide-react";
import { NavLink, ThemeToggle, MobileNav } from "./chrome";
import { DataViewToggle } from "./data-view-toggle";
import { Toaster } from "./toast";

/** Persistent app chrome: branded sidebar + top bar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground font-bold tracking-tight">
            D
          </span>
          <span className="leading-tight">
            <span className="block font-serif text-base font-medium tracking-tight">Dan</span>
            <span className="block text-xs text-muted-foreground">Pam&rsquo;s sales guy</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1 px-3 py-2">
          <NavLink href="/today" icon={<Inbox className="h-4 w-4" />}>
            Today
          </NavLink>
          <NavLink href="/sequences" icon={<Rocket className="h-4 w-4" />}>
            Prospect
          </NavLink>
          <NavLink href="/accounts" icon={<Building2 className="h-4 w-4" />}>
            Book
          </NavLink>
        </nav>
        <div className="mt-auto px-5 py-4 text-xs text-muted-foreground">
          Book of business
          <br />
          North American franchise rooftops
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card/60 px-5 backdrop-blur">
          <div className="text-sm font-medium md:hidden">Dan</div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-4">
            <DataViewToggle />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-5 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>
      <MobileNav />
      <Toaster />
    </div>
  );
}

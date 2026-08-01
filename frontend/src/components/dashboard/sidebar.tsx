"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  LogOut,
  Menu,
  ShieldCheck,
  Wheat,
} from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const SIDEBAR_STORAGE_KEY = "panduranga-dashboard-sidebar";

function NavContent({
  email,
  collapsed = false,
  onNavigate,
}: {
  email: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const analyzerActive = pathname === "/dashboard";
  const reportsActive = pathname.startsWith("/dashboard/reports");
  const navItem = (active: boolean) =>
    `group flex h-10 items-center rounded-lg text-sm transition-colors ${
      collapsed ? "justify-center px-0" : "gap-3 px-3"
    } ${
      active
        ? "bg-amber-100 font-semibold text-amber-950 dark:bg-amber-900/40 dark:text-amber-200"
        : "text-gray-600 hover:bg-amber-50 hover:text-amber-900 dark:text-gray-400 dark:hover:bg-amber-900/20 dark:hover:text-amber-300"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-gray-900">
      <div className={`flex h-16 shrink-0 items-center border-b border-amber-200 dark:border-amber-900/50 ${collapsed ? "justify-center px-2" : "px-4"}`}>
        <Link
          href="/"
          onClick={onNavigate}
          className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-3"}`}
          aria-label={collapsed ? "Panduranga home" : undefined}
          title={collapsed ? "Panduranga" : undefined}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-300">
            <Wheat className="h-5 w-5" />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-amber-900 dark:text-amber-300">Panduranga</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Mill accounts</p>
            </div>
          )}
        </Link>
      </div>

      <nav className={`flex-1 space-y-1 py-4 ${collapsed ? "px-2" : "px-3"}`} aria-label="Dashboard navigation">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          aria-current={analyzerActive ? "page" : undefined}
          aria-label={collapsed ? "Excel analysis" : undefined}
          title={collapsed ? "Excel analysis" : undefined}
          className={navItem(analyzerActive)}
        >
          <BarChart3 className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Excel analysis</span>}
        </Link>
        <Link
          href="/dashboard/reports"
          onClick={onNavigate}
          aria-current={reportsActive ? "page" : undefined}
          aria-label={collapsed ? "Saved reports" : undefined}
          title={collapsed ? "Saved reports" : undefined}
          className={navItem(reportsActive)}
        >
          <Clock3 className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Saved reports</span>}
        </Link>
        <Link
          href="/"
          onClick={onNavigate}
          aria-label={collapsed ? "Public website" : undefined}
          title={collapsed ? "Public website" : undefined}
          className={navItem(false)}
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Public website</span>}
        </Link>
      </nav>

      <div className={`shrink-0 border-t border-amber-200 dark:border-amber-900/50 ${collapsed ? "px-2 py-3" : "px-4 py-4"}`}>
        {collapsed ? (
          <div className="space-y-2">
            <div className="flex h-9 items-center justify-center text-emerald-600 dark:text-emerald-400" title="Private account" aria-label="Private account">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" className="h-9 w-full text-gray-500 hover:text-rose-700 dark:text-gray-400 dark:hover:text-rose-300" aria-label="Sign out" title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Private account
            </div>
            <div className="mt-3 border-t border-amber-100 pt-3 dark:border-amber-900/40">
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400" title={email}>{email}</p>
              <form action={logoutAction} className="mt-1.5">
                <Button type="submit" variant="ghost" size="sm" className="h-8 w-full justify-start gap-2 px-2 text-gray-600 hover:text-rose-700 dark:text-gray-400 dark:hover:text-rose-300">
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ email }: { email: string }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  }

  return (
    <aside className={`relative hidden shrink-0 flex-col border-r border-amber-200 transition-[width] duration-200 lg:flex dark:border-amber-900/50 ${collapsed ? "w-[68px]" : "w-60"}`}>
      <NavContent email={email} collapsed={collapsed} />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggleSidebar}
        className="absolute -right-3.5 top-[82px] z-10 h-7 w-7 rounded-full border-amber-200 bg-white text-gray-500 shadow-sm hover:text-amber-800 dark:border-amber-900 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-amber-300"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </Button>
    </aside>
  );
}

export function MobileSidebar({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-white p-0 dark:bg-gray-900">
          <NavContent email={email} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

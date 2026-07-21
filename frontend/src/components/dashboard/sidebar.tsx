"use client";

import Link from "next/link";
import { BarChart3, ExternalLink, Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useState } from "react";

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="border-b border-amber-200 px-4 py-5 dark:border-amber-900/50">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2">
          <span className="text-2xl">🌾</span>
          <div>
            <p className="text-sm font-bold leading-tight text-amber-900 dark:text-amber-300">Panduranga</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">Private workspace</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg bg-amber-100 px-3 py-2.5 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
        >
          <BarChart3 className="h-4 w-4" />
          Excel analysis
        </Link>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-600 transition-colors hover:bg-amber-50 hover:text-amber-900 dark:text-gray-400 dark:hover:bg-amber-900/20 dark:hover:text-amber-300"
        >
          <ExternalLink className="h-4 w-4" />
          Public website
        </Link>
      </nav>

      <div className="border-t border-amber-200 px-4 py-4 dark:border-amber-900/50">
        <div className="flex items-start gap-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Excel files stay on this device.
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-amber-200 lg:flex dark:border-amber-900/50">
      <NavContent />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 bg-white p-0 dark:bg-gray-900">
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

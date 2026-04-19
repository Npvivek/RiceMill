"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Wheat, BarChart3,
  Users, ShoppingCart, LogOut, Menu, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useState } from "react";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Government", icon: Building2, children: [
      { label: "Paddy Lots", href: "/dashboard/government/lots" },
      { label: "Godown Deliveries", href: "/dashboard/government/deliveries" },
    ]
  },
  {
    label: "Inventory", icon: Wheat, children: [
      { label: "Milling Runs", href: "/dashboard/inventory/milling" },
      { label: "By-product Stock", href: "/dashboard/inventory/stock" },
    ]
  },
  { label: "Parties", href: "/dashboard/parties", icon: Users },
  { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await api.post("/api/auth/logout").catch(() => null);
    router.push("/login");
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="px-4 py-5 border-b border-amber-200 dark:border-amber-900/50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌾</span>
          <div>
            <p className="font-bold text-sm leading-tight text-amber-900 dark:text-amber-300">Panduranga</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">Rice Mill</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          if (item.children) {
            return (
              <div key={item.label} className="mb-1">
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-500 uppercase tracking-wider">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </div>
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    className={cn(
                      "block pl-7 pr-2 py-1.5 text-sm rounded-md transition-colors",
                      pathname === child.href
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-900 dark:hover:text-amber-300"
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            );
          }
          const Icon = item.icon!;
          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 px-2 py-2 text-sm rounded-md transition-colors",
                pathname === item.href
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-900 dark:hover:text-amber-300"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-amber-200 dark:border-amber-900/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col w-56 border-r border-amber-200 dark:border-amber-900/50 shrink-0">
      <NavContent />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
        <Menu className="w-5 h-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-56 bg-white dark:bg-gray-900">
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

import { Sidebar, MobileSidebar } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-amber-200 bg-white/95 px-4 backdrop-blur dark:border-amber-900/50 dark:bg-gray-900/95">
          <MobileSidebar />
          <span className="flex-1 text-sm font-medium text-gray-500 lg:hidden dark:text-gray-400">Mill accounts</span>
          <span className="hidden text-xs text-gray-500 lg:block dark:text-gray-400">Private workbook analysis · processed on this device</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-7 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

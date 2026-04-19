import { Sidebar, MobileSidebar } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-amber-200 dark:border-amber-900/50 flex items-center px-4 gap-3 shrink-0">
          <MobileSidebar />
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 lg:hidden flex-1">Panduranga Rice Mill</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

import { Sidebar, MobileSidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-14 bg-white border-b border-amber-200 flex items-center px-4 gap-3 shrink-0">
          <MobileSidebar />
          <span className="text-sm font-medium text-gray-500 lg:hidden">Panduranga Rice Mill</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

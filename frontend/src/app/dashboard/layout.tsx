import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Sidebar, MobileSidebar } from "@/components/dashboard/sidebar";
import { DashboardNavigationMetrics } from "@/components/dashboard/dashboard-navigation-metrics";
import { ThemeToggle } from "@/components/ui/theme-toggle";

function emailFromProxyHeader(value: string | null): string {
  if (!value) return "Mill account";
  try {
    return decodeURIComponent(value) || "Mill account";
  } catch {
    return "Mill account";
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-rice-mill-user-id");
  const userEmail = requestHeaders.get("x-rice-mill-user-email");

  if (!userId) redirect("/login");
  const email = emailFromProxyHeader(userEmail);

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-gray-950">
      <DashboardNavigationMetrics />
      <Sidebar email={email} />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-amber-200 bg-white/95 px-4 backdrop-blur dark:border-amber-900/50 dark:bg-gray-900/95">
          <MobileSidebar email={email} />
          <span className="flex-1 text-sm font-medium text-gray-500 lg:hidden dark:text-gray-400">Mill accounts</span>
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

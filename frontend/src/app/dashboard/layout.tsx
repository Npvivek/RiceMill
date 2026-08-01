import { redirect } from "next/navigation";
import { Sidebar, MobileSidebar } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-gray-950">
      <Sidebar email={user.email ?? "Mill account"} />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-amber-200 bg-white/95 px-4 backdrop-blur dark:border-amber-900/50 dark:bg-gray-900/95">
          <MobileSidebar email={user.email ?? "Mill account"} />
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

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardNavigationMetrics } from "@/components/dashboard/dashboard-navigation-metrics";

export default async function ImportLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  if (!requestHeaders.get("x-rice-mill-user-id")) redirect("/login?next=/import");
  return <><DashboardNavigationMetrics />{children}</>;
}

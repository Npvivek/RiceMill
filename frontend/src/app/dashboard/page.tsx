"use client";

import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wheat, IndianRupee, TrendingUp, Package, Building2 } from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/reports/dashboard").then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "By-product Stock",
      value: data ? fmt.qtl(data.total_stock_qtl) : "—",
      sub: "Broken rice / husk / bran",
      icon: Wheat,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/30",
    },
    {
      title: "Pending Dues",
      value: data ? fmt.currency(data.pending_invoices_amount) : "—",
      sub: `${data?.pending_invoices_count || 0} invoices`,
      icon: IndianRupee,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-900/30",
    },
    {
      title: "This Month Revenue",
      value: data ? fmt.currency(data.month_revenue) : "—",
      sub: "From by-product sales",
      icon: TrendingUp,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/30",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.title} className="border-border bg-card">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{s.title}</p>
                  <p className="text-lg font-bold text-foreground mt-1">{s.value}</p>
                  {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
                </div>
                <div className={`p-2 rounded-lg ${s.bg}`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data?.active_govt_lots > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Govt Lots</p>
                <p className="text-lg font-bold text-foreground mt-1">{data.active_govt_lots}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pending delivery to godowns</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {data?.stock_breakdown?.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-foreground">
              <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Current By-product Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {data.stock_breakdown.map((s: { rice_type: string; grade: string; quantity_qtl: number }) => (
                <div key={`${s.rice_type}-${s.grade}`} className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-100 dark:border-amber-900/40">
                  <p className="text-xs text-amber-700 dark:text-amber-400 capitalize font-medium">{s.rice_type.replace(/_/g, " ")}</p>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200 mt-0.5">{fmt.qtl(s.quantity_qtl)}</p>
                  <Badge variant="outline" className="text-xs mt-1 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                    Grade {s.grade}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data?.recent_orders?.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recent_orders.map((o: { id: number; order_number: string; status: string; created_at: string }) => (
                <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-sm font-medium text-foreground">{o.order_number}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{fmt.date(o.created_at)}</span>
                    <Badge
                      variant={o.status === "delivered" ? "default" : "secondary"}
                      className="text-xs capitalize"
                    >
                      {o.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

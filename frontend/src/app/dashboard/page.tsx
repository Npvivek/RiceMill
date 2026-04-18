"use client";

import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wheat, IndianRupee, Users, TrendingUp, Package } from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/reports/dashboard").then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "Total Rice Stock",
      value: data ? fmt.qtl(data.total_stock_qtl) : "—",
      icon: Wheat,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Pending Dues",
      value: data ? fmt.currency(data.pending_invoices_amount) : "—",
      sub: `${data?.pending_invoices_count || 0} invoices`,
      icon: IndianRupee,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "This Month Revenue",
      value: data ? fmt.currency(data.month_revenue) : "—",
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Present Today",
      value: data ? `${data.present_today} workers` : "—",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.title}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">{s.title}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{s.value}</p>
                  {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
                </div>
                <div className={`p-2 rounded-lg ${s.bg}`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data?.stock_breakdown?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" />
              Current Stock Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.stock_breakdown.map((s: { rice_type: string; grade: string; quantity_qtl: number }) => (
                <div key={`${s.rice_type}-${s.grade}`} className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-700 capitalize font-medium">{s.rice_type.replace(/_/g, " ")}</p>
                  <p className="text-sm font-bold text-amber-900 mt-0.5">{fmt.qtl(s.quantity_qtl)}</p>
                  <Badge variant="outline" className="text-xs mt-1">Grade {s.grade}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data?.recent_orders?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recent_orders.map((o: { id: number; order_number: string; status: string; created_at: string }) => (
                <div key={o.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm font-medium text-gray-700">{o.order_number}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{fmt.date(o.created_at)}</span>
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

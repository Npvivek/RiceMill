"use client";

import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MOV_COLORS: Record<string, string> = {
  milling_out: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  sale_out: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  adjustment: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
};

export default function StockPage() {
  const { data: stock = [], isLoading: stockLoading } = useQuery({
    queryKey: ["stock"],
    queryFn: () => api.get("/api/inventory/stock").then((r) => r.data),
  });

  const { data: movements = [], isLoading: movLoading } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: () => api.get("/api/inventory/stock/movements").then((r) => r.data),
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-foreground">By-product Stock</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stockLoading
          ? [...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)
          : stock.map((s: { id: number; rice_type: string; grade: string; quantity_qtl: number }) => (
            <Card key={s.id} className="border-border bg-card hover:border-amber-400 dark:hover:border-amber-600 transition-colors">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 capitalize">{s.rice_type.replace(/_/g, " ")}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{fmt.number(s.quantity_qtl)}</p>
                <p className="text-xs text-muted-foreground">quintals</p>
                <Badge variant="outline" className="text-xs mt-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                  Grade {s.grade}
                </Badge>
              </CardContent>
            </Card>
          ))}
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">Stock Movements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {movLoading ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {["Date", "Type", "Item", "Qty (qtl)", "Reference"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movements.map((m: {
                    id: number; movement_date: string; movement_type: string;
                    item_type: string; quantity_qtl: number; reference_type: string; reference_id: number;
                  }) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{fmt.date(m.movement_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MOV_COLORS[m.movement_type] ?? "bg-muted text-muted-foreground"}`}>
                          {m.movement_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize text-foreground">{m.item_type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{fmt.number(m.quantity_qtl)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{m.reference_type} #{m.reference_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

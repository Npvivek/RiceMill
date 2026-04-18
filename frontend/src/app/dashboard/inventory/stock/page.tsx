"use client";

import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StockPage() {
  const { data: stock = [], isLoading: stockLoading } = useQuery({
    queryKey: ["stock"],
    queryFn: () => api.get("/api/inventory/stock").then((r) => r.data),
  });

  const { data: movements = [], isLoading: movLoading } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: () => api.get("/api/inventory/stock/movements").then((r) => r.data),
  });

  const movColor: Record<string, string> = {
    milling_out: "bg-green-100 text-green-700",
    sale_out: "bg-red-100 text-red-700",
    adjustment: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Rice Stock</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stockLoading
          ? [...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)
          : stock.map((s: { id: number; rice_type: string; grade: string; quantity_qtl: number }) => (
            <Card key={s.id} className="border-amber-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-amber-700 capitalize">{s.rice_type.replace(/_/g, " ")}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{fmt.number(s.quantity_qtl)}</p>
                <p className="text-xs text-gray-400">quintals</p>
                <Badge variant="outline" className="text-xs mt-2">Grade {s.grade}</Badge>
              </CardContent>
            </Card>
          ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stock Movements (Last 100)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {movLoading ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Date", "Type", "Item", "Qty (qtl)", "Reference"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m: {
                    id: number; movement_date: string; movement_type: string;
                    item_type: string; quantity_qtl: number; reference_type: string; reference_id: number;
                  }) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{fmt.date(m.movement_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${movColor[m.movement_type] || "bg-gray-100 text-gray-600"}`}>
                          {m.movement_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-700">{m.item_type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-medium">{fmt.number(m.quantity_qtl)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{m.reference_type} #{m.reference_id}</td>
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

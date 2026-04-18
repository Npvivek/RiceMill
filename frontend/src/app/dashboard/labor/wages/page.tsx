"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calculator, CheckCircle } from "lucide-react";

type WagePreview = {
  employee_id: number;
  employee_name: string;
  days_worked: number;
  basic_amount: number;
  overtime_hours: number;
  overtime_amount: number;
  net_amount: number;
};

export default function WagesPage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [preview, setPreview] = useState<WagePreview[]>([]);

  const { data: unpaidWages = [] } = useQuery({
    queryKey: ["wages-unpaid"],
    queryFn: () => api.get("/api/labor/wages?is_paid=false").then((r) => r.data),
  });

  const calculate = useMutation({
    mutationFn: () => api.post("/api/labor/wages/calculate", { period_from: from, period_to: to }).then((r) => r.data),
    onSuccess: (data) => setPreview(data),
    onError: () => toast.error("Failed to calculate wages"),
  });

  const createAndPay = useMutation({
    mutationFn: () => api.post("/api/labor/wages/create", { period_from: from, period_to: to }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wages-unpaid"] });
      toast.success("Wage records created — mark as paid when disbursed");
      setPreview([]);
    },
    onError: () => toast.error("Failed to create wage records"),
  });

  const markPaid = useMutation({
    mutationFn: (ids: number[]) => api.post("/api/labor/wages/pay", {
      wage_payment_ids: ids,
      payment_date: today,
      payment_mode: "cash",
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wages-unpaid"] });
      toast.success("Wages marked as paid");
    },
    onError: () => toast.error("Failed to mark as paid"),
  });

  const totalNet = preview.reduce((s, p) => s + p.net_amount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Wages</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Calculate Wages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
            </div>
            <Button className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => calculate.mutate()} disabled={calculate.isPending}>
              <Calculator className="w-4 h-4" /> {calculate.isPending ? "Calculating…" : "Calculate"}
            </Button>
          </div>

          {preview.length > 0 && (
            <div className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Employee", "Days", "Basic", "OT Hours", "OT Pay", "Net"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((p) => (
                      <tr key={p.employee_id}>
                        <td className="px-3 py-2 font-medium text-gray-800">{p.employee_name}</td>
                        <td className="px-3 py-2 text-gray-600">{p.days_worked}</td>
                        <td className="px-3 py-2">{fmt.currency(p.basic_amount)}</td>
                        <td className="px-3 py-2 text-gray-600">{p.overtime_hours}h</td>
                        <td className="px-3 py-2">{fmt.currency(p.overtime_amount)}</td>
                        <td className="px-3 py-2 font-bold text-green-700">{fmt.currency(p.net_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right font-semibold text-gray-700">Total</td>
                      <td className="px-3 py-2 font-bold text-green-700">{fmt.currency(totalNet)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex justify-end mt-3">
                <Button className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={() => createAndPay.mutate()} disabled={createAndPay.isPending}>
                  <CheckCircle className="w-4 h-4" /> {createAndPay.isPending ? "Creating…" : "Create Wage Records"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {unpaidWages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-orange-700">Pending Wage Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Employee", "Period", "Net Amount", ""].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(unpaidWages as { id: number; employee_id: number; period_from: string; period_to: string; net_amount: number }[]).map((w) => (
                    <tr key={w.id}>
                      <td className="px-3 py-2 font-medium text-gray-800">Employee #{w.employee_id}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{fmt.date(w.period_from)} – {fmt.date(w.period_to)}</td>
                      <td className="px-3 py-2 font-semibold text-orange-700">{fmt.currency(w.net_amount)}</td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50 gap-1 h-7"
                          onClick={() => markPaid.mutate([w.id])}>
                          <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

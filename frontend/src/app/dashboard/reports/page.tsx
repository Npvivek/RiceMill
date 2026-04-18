"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = today.slice(0, 8) + "01";

function DateFilter({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  return (
    <div className="flex items-end gap-3 flex-wrap mb-4">
      <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={f} onChange={(e) => setF(e.target.value)} className="w-36 h-8" /></div>
      <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={t} onChange={(e) => setT(e.target.value)} className="w-36 h-8" /></div>
      <Button size="sm" variant="outline" className="h-8" onClick={() => onChange(f, t)}>Apply</Button>
    </div>
  );
}

function YieldTab() {
  const [range, setRange] = useState({ from: firstOfMonth, to: today });
  const { data, isFetching } = useQuery({
    queryKey: ["yield", range],
    queryFn: () => api.get(`/api/reports/yield-analysis?date_from=${range.from}&date_to=${range.to}`).then((r) => r.data),
  });
  const s = data?.summary;
  return (
    <div>
      <DateFilter from={range.from} to={range.to} onChange={(f, t) => setRange({ from: f, to: t })} />
      {isFetching ? <div className="h-32 bg-gray-100 rounded-lg animate-pulse" /> : s ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total Runs", value: s.total_runs },
              { label: "Paddy Input", value: fmt.qtl(s.total_paddy_qtl) },
              { label: "Milled Rice", value: fmt.qtl(s.total_milled_rice_qtl) },
              { label: "Avg Yield %", value: `${s.avg_yield_pct}%` },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-xl font-bold text-amber-700 mt-1">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                {["Run #", "Date", "Paddy (qtl)", "Milled (qtl)", "Yield %"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {(data.runs as { run_number: string; run_date: string; paddy_used_qtl: number; milled_rice_qtl: number; yield_pct: number }[]).map((r) => (
                  <tr key={r.run_number} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-amber-700">{r.run_number}</td>
                    <td className="px-4 py-2.5 text-gray-600">{fmt.date(r.run_date)}</td>
                    <td className="px-4 py-2.5">{fmt.qtl(r.paddy_used_qtl)}</td>
                    <td className="px-4 py-2.5">{fmt.qtl(r.milled_rice_qtl)}</td>
                    <td className="px-4 py-2.5 font-medium">{r.yield_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </>
      ) : <p className="text-sm text-gray-400">No data for this period</p>}
    </div>
  );
}

function RevenueTab() {
  const [range, setRange] = useState({ from: firstOfMonth, to: today });
  const { data, isFetching } = useQuery({
    queryKey: ["revenue", range],
    queryFn: () => api.get(`/api/reports/revenue-summary?date_from=${range.from}&date_to=${range.to}`).then((r) => r.data),
  });
  return (
    <div>
      <DateFilter from={range.from} to={range.to} onChange={(f, t) => setRange({ from: f, to: t })} />
      {isFetching ? <div className="h-32 bg-gray-100 rounded-lg animate-pulse" /> : data ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Invoiced", value: fmt.currency(data.total_billed), color: "text-gray-900" },
            { label: "Collected", value: fmt.currency(data.total_collected), color: "text-green-700" },
            { label: "Outstanding", value: fmt.currency(data.total_outstanding), color: "text-red-600" },
            { label: "Paid Invoices", value: data.paid_count, color: "text-green-700" },
            { label: "Partial", value: data.partial_count, color: "text-yellow-700" },
            { label: "Unpaid", value: data.unpaid_count, color: "text-red-600" },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DuesTab({ endpoint, title }: { endpoint: string; title: string }) {
  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: () => api.get(`/api/reports/${endpoint}`).then((r) => r.data),
  });
  const isFarmer = endpoint === "farmer-dues";
  return (
    <div>
      {isLoading ? <div className="h-32 bg-gray-100 rounded-lg animate-pulse" /> : data ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">{data.count} records</p>
            <p className="text-lg font-bold text-red-600">Total: {fmt.currency(data.total_outstanding)}</p>
          </div>
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                {(isFarmer
                  ? ["Batch #", "Date", "Farmer", "Total", "Paid", "Outstanding", "Status"]
                  : ["Invoice #", "Date", "Customer", "Total", "Paid", "Balance", "Days"]
                ).map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {isFarmer
                  ? (data.dues as { batch_number: string; received_date: string; farmer_name: string | null; total_amount: number; amount_paid: number; outstanding: number; payment_status: string }[]).map((d) => (
                    <tr key={d.batch_number} className="hover:bg-red-50">
                      <td className="px-4 py-2.5 font-medium text-amber-700">{d.batch_number}</td>
                      <td className="px-4 py-2.5 text-gray-500">{fmt.date(d.received_date)}</td>
                      <td className="px-4 py-2.5">{d.farmer_name || "—"}</td>
                      <td className="px-4 py-2.5">{fmt.currency(d.total_amount)}</td>
                      <td className="px-4 py-2.5 text-green-600">{fmt.currency(d.amount_paid)}</td>
                      <td className="px-4 py-2.5 font-semibold text-red-600">{fmt.currency(d.outstanding)}</td>
                      <td className="px-4 py-2.5 capitalize text-xs">{d.payment_status}</td>
                    </tr>
                  ))
                  : (data.dues as { invoice_number: string; invoice_date: string; customer_name: string | null; total_amount: number; amount_paid: number; balance_due: number; days_overdue: number }[]).map((d) => (
                    <tr key={d.invoice_number} className="hover:bg-red-50">
                      <td className="px-4 py-2.5 font-medium text-amber-700">{d.invoice_number}</td>
                      <td className="px-4 py-2.5 text-gray-500">{fmt.date(d.invoice_date)}</td>
                      <td className="px-4 py-2.5">{d.customer_name || "—"}</td>
                      <td className="px-4 py-2.5">{fmt.currency(d.total_amount)}</td>
                      <td className="px-4 py-2.5 text-green-600">{fmt.currency(d.amount_paid)}</td>
                      <td className="px-4 py-2.5 font-semibold text-red-600">{fmt.currency(d.balance_due)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{d.days_overdue}d</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent></Card>
        </>
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      <Tabs defaultValue="yield">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="yield">Yield Analysis</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="pending-dues">Customer Dues</TabsTrigger>
          <TabsTrigger value="farmer-dues">Farmer Dues</TabsTrigger>
        </TabsList>
        <TabsContent value="yield" className="mt-4"><YieldTab /></TabsContent>
        <TabsContent value="revenue" className="mt-4"><RevenueTab /></TabsContent>
        <TabsContent value="pending-dues" className="mt-4"><DuesTab endpoint="pending-dues" title="Customer Outstanding" /></TabsContent>
        <TabsContent value="farmer-dues" className="mt-4"><DuesTab endpoint="farmer-dues" title="Farmer Dues" /></TabsContent>
      </Tabs>
    </div>
  );
}

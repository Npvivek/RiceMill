"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function PaddyBatchesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["paddy-batches"],
    queryFn: () => api.get("/api/inventory/paddy/batches").then((r) => r.data),
  });

  const { data: varieties = [] } = useQuery({
    queryKey: ["paddy-varieties"],
    queryFn: () => api.get("/api/inventory/paddy/varieties").then((r) => r.data),
  });

  const { data: farmers = [] } = useQuery({
    queryKey: ["parties-farmers"],
    queryFn: () => api.get("/api/parties/?party_type=supplier").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/inventory/paddy/batches", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paddy-batches"] });
      toast.success("Paddy batch recorded");
      setOpen(false);
    },
    onError: () => toast.error("Failed to record batch"),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      supplier_id: Number(fd.get("supplier_id")),
      variety_id: Number(fd.get("variety_id")),
      received_date: fd.get("received_date"),
      gross_weight_qtl: Number(fd.get("gross_weight_qtl")),
      tare_weight_qtl: Number(fd.get("tare_weight_qtl") || 0),
      moisture_pct: fd.get("moisture_pct") ? Number(fd.get("moisture_pct")) : null,
      grade: fd.get("grade"),
      purchase_price_per_qtl: Number(fd.get("purchase_price_per_qtl")),
      vehicle_number: fd.get("vehicle_number") || null,
    });
  }

  const statusColor: Record<string, string> = {
    paid: "bg-green-100 text-green-800",
    partial: "bg-yellow-100 text-yellow-800",
    unpaid: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Paddy Batches</h1>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Record Batch
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Paddy Batch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Farmer</Label>
                  <Select name="supplier_id" required>
                    <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
                    <SelectContent>
                      {farmers.map((f: { id: number; name: string }) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Variety</Label>
                  <Select name="variety_id" required>
                    <SelectTrigger><SelectValue placeholder="Select variety" /></SelectTrigger>
                    <SelectContent>
                      {varieties.map((v: { id: number; name: string }) => (
                        <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Date</Label>
                  <Input name="received_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Gross Weight (qtl)</Label>
                  <Input name="gross_weight_qtl" type="number" step="0.001" inputMode="decimal" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Tare Weight (qtl)</Label>
                  <Input name="tare_weight_qtl" type="number" step="0.001" inputMode="decimal" defaultValue="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Price / qtl (₹)</Label>
                  <Input name="purchase_price_per_qtl" type="number" step="0.01" inputMode="decimal" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Moisture %</Label>
                  <Input name="moisture_pct" type="number" step="0.1" inputMode="decimal" />
                </div>
                <div className="space-y-1.5">
                  <Label>Grade</Label>
                  <Select name="grade" defaultValue="A">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Vehicle No.</Label>
                  <Input name="vehicle_number" placeholder="AP 31 AB 1234" />
                </div>
              </div>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Save Batch"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : batches.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">No paddy batches yet</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Batch #", "Date", "Farmer", "Net Weight", "Price/qtl", "Total", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {batches.map((b: {
                    id: number; batch_number: string; received_date: string;
                    supplier?: { name: string }; net_weight_qtl: number;
                    purchase_price_per_qtl: number; total_amount: number; payment_status: string;
                  }) => (
                    <tr key={b.id} className="hover:bg-amber-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-amber-700">{b.batch_number}</td>
                      <td className="px-4 py-3 text-gray-600">{fmt.date(b.received_date)}</td>
                      <td className="px-4 py-3 text-gray-700">{b.supplier?.name || "—"}</td>
                      <td className="px-4 py-3">{fmt.qtl(b.net_weight_qtl)}</td>
                      <td className="px-4 py-3">{fmt.currency(b.purchase_price_per_qtl)}</td>
                      <td className="px-4 py-3 font-medium">{fmt.currency(b.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor[b.payment_status] || ""}`}>
                          {b.payment_status}
                        </span>
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

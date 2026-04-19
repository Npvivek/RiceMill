"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Truck } from "lucide-react";

export default function GodownDeliveriesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["govt-deliveries"],
    queryFn: () => api.get("/api/government/deliveries").then((r) => r.data),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ["govt-lots"],
    queryFn: () => api.get("/api/government/lots").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/government/deliveries", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["govt-deliveries"] });
      qc.invalidateQueries({ queryKey: ["govt-lots"] });
      toast.success("Delivery challan recorded");
      setOpen(false);
    },
    onError: () => toast.error("Failed to record delivery"),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      lot_id: Number(fd.get("lot_id")),
      godown_name: fd.get("godown_name"),
      godown_location: fd.get("godown_location") || null,
      quantity_qtl: Number(fd.get("quantity_qtl")),
      delivery_date: fd.get("delivery_date"),
      vehicle_number: fd.get("vehicle_number") || null,
      driver_name: fd.get("driver_name") || null,
      notes: fd.get("notes") || null,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Godown Deliveries</h1>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Record Delivery
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Godown Delivery</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Government Lot *</Label>
              <Select name="lot_id" required>
                <SelectTrigger><SelectValue placeholder="Select lot" /></SelectTrigger>
                <SelectContent>
                  {lots.map((l: { id: number; lot_number: string; paddy_variety: string }) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.lot_number} — {l.paddy_variety}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Godown Name *</Label>
                <Input name="godown_name" required placeholder="e.g. Hanuman Junction FPS" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Godown Location</Label>
                <Input name="godown_location" placeholder="Village / mandal" />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity (qtl) *</Label>
                <Input name="quantity_qtl" type="number" step="0.01" inputMode="decimal" required />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Date *</Label>
                <Input name="delivery_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-1.5">
                <Label>Vehicle No.</Label>
                <Input name="vehicle_number" placeholder="AP 16 XX 0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Driver Name</Label>
                <Input name="driver_name" placeholder="Optional" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Input name="notes" placeholder="Optional" />
              </div>
            </div>
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Record Delivery"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : deliveries.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-14 text-center">
            <Truck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No deliveries recorded yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Record each challan as rice leaves for godowns</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {["Challan No.", "Lot", "Godown", "Qty (qtl)", "Date", "Vehicle"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries.map((d: {
                    id: number; challan_number: string; lot_number: string;
                    godown_name: string; godown_location: string | null;
                    quantity_qtl: number; delivery_date: string; vehicle_number: string | null;
                  }) => (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-amber-700 dark:text-amber-400">{d.challan_number}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{d.lot_number}</td>
                      <td className="px-4 py-3 text-foreground">
                        {d.godown_name}
                        {d.godown_location && <span className="text-muted-foreground text-xs block">{d.godown_location}</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{fmt.qtl(d.quantity_qtl)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmt.date(d.delivery_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{d.vehicle_number ?? "—"}</td>
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

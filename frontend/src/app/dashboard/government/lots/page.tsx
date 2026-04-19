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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Building2, Wheat } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  milling: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
  milled: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
  delivered: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  closed: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

const CHARGE_FIELDS = [
  { name: "milling_charge_qtl", label: "Milling Charge" },
  { name: "sortex_charge_qtl", label: "Sortex Charge" },
  { name: "paddy_transport_charge_qtl", label: "Paddy Transport" },
  { name: "rice_transport_charge_qtl", label: "Rice Transport" },
  { name: "blending_charge_qtl", label: "Blending Charge" },
  { name: "gunny_charge_qtl", label: "Gunny Usage" },
];

export default function GovernmentLotsPage() {
  const qc = useQueryClient();
  const [lotOpen, setLotOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);

  const { data: lots = [], isLoading: lotsLoading } = useQuery({
    queryKey: ["govt-lots"],
    queryFn: () => api.get("/api/government/lots").then((r) => r.data),
  });

  const { data: seasons = [], isLoading: seasonsLoading } = useQuery({
    queryKey: ["govt-seasons"],
    queryFn: () => api.get("/api/government/seasons").then((r) => r.data),
  });

  const createLot = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/government/lots", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["govt-lots"] }); toast.success("Lot recorded"); setLotOpen(false); },
    onError: () => toast.error("Failed to record lot"),
  });

  const createSeason = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/government/seasons", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["govt-seasons"] }); toast.success("Season rates saved"); setSeasonOpen(false); },
    onError: () => toast.error("Failed to save season"),
  });

  function handleLotSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createLot.mutate({
      lot_number: fd.get("lot_number"),
      season_id: Number(fd.get("season_id")),
      paddy_variety: fd.get("paddy_variety"),
      quantity_qtl: Number(fd.get("quantity_qtl")),
      received_date: fd.get("received_date"),
      notes: fd.get("notes") || null,
    });
  }

  function handleSeasonSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createSeason.mutate({
      season_type: fd.get("season_type"),
      year: fd.get("year"),
      milling_charge_qtl: Number(fd.get("milling_charge_qtl")),
      sortex_charge_qtl: Number(fd.get("sortex_charge_qtl")),
      paddy_transport_charge_qtl: Number(fd.get("paddy_transport_charge_qtl")),
      rice_transport_charge_qtl: Number(fd.get("rice_transport_charge_qtl")),
      blending_charge_qtl: Number(fd.get("blending_charge_qtl")),
      gunny_charge_qtl: Number(fd.get("gunny_charge_qtl")),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Government Lots</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSeasonOpen(true)}
            className="gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40">
            <Plus className="w-4 h-4" /> Season Rates
          </Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => setLotOpen(true)}>
            <Plus className="w-4 h-4" /> New Lot
          </Button>
        </div>
      </div>

      {/* Season Dialog */}
      <Dialog open={seasonOpen} onOpenChange={setSeasonOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Season Rates</DialogTitle></DialogHeader>
          <form onSubmit={handleSeasonSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Season *</Label>
                <Select name="season_type" required>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kharif">Kharif</SelectItem>
                    <SelectItem value="Rabi">Rabi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year *</Label>
                <Input name="year" placeholder="e.g. 2025" required />
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">APSCSCL Rates (₹ per quintal)</p>
              <div className="grid grid-cols-2 gap-3">
                {CHARGE_FIELDS.map((f) => (
                  <div key={f.name} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input name={f.name} type="number" step="0.01" inputMode="decimal" required placeholder="0.00" />
                  </div>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={createSeason.isPending}>
              {createSeason.isPending ? "Saving…" : "Save Season Rates"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Lot Dialog */}
      <Dialog open={lotOpen} onOpenChange={setLotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Government Lot</DialogTitle></DialogHeader>
          <form onSubmit={handleLotSubmit} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Season *</Label>
              <Select name="season_id" required>
                <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                <SelectContent>
                  {seasons.map((s: { id: number; season_type: string; year: string }) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.season_type} {s.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lot Number *</Label>
              <Input name="lot_number" required placeholder="APSCSCL-issued reference" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Paddy Variety</Label>
                <Select name="paddy_variety" defaultValue="BPT 5204">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BPT 5204">BPT 5204</SelectItem>
                    <SelectItem value="MTU 1010">MTU 1010</SelectItem>
                    <SelectItem value="Rajanna">Rajanna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity (qtl) *</Label>
                <Input name="quantity_qtl" type="number" step="0.01" inputMode="decimal" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Received Date *</Label>
              <Input name="received_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Optional" />
            </div>
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={createLot.isPending}>
              {createLot.isPending ? "Saving…" : "Record Lot"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="lots">
        <TabsList>
          <TabsTrigger value="lots">Lots</TabsTrigger>
          <TabsTrigger value="seasons">Season Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="lots" className="mt-4">
          {lotsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
          ) : lots.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-14 text-center">
                <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No lots recorded yet</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Add a season first, then record incoming lots</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        {["Lot No.", "Season", "Variety", "Qty (qtl)", "Received", "Exp. Revenue", "Status"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lots.map((l: {
                        id: number; lot_number: string; season_type: string; year: string;
                        paddy_variety: string; quantity_qtl: number; received_date: string;
                        status: string; total_charge_qtl: number;
                      }) => (
                        <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-amber-700 dark:text-amber-400">{l.lot_number}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{l.season_type} {l.year}</td>
                          <td className="px-4 py-3 text-foreground">{l.paddy_variety}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{fmt.qtl(l.quantity_qtl)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{fmt.date(l.received_date)}</td>
                          <td className="px-4 py-3 font-semibold text-green-700 dark:text-green-400">
                            {fmt.currency(l.quantity_qtl * l.total_charge_qtl)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[l.status] ?? ""}`}>
                              {l.status}
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
        </TabsContent>

        <TabsContent value="seasons" className="mt-4">
          {seasonsLoading ? (
            <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />)}</div>
          ) : seasons.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-14 text-center">
                <Wheat className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No seasons configured</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Add APSCSCL season rates before recording lots</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {seasons.map((s: {
                id: number; season_type: string; year: string;
                milling_charge_qtl: number; sortex_charge_qtl: number;
                paddy_transport_charge_qtl: number; rice_transport_charge_qtl: number;
                blending_charge_qtl: number; gunny_charge_qtl: number; total_charge_qtl: number;
              }) => (
                <Card key={s.id} className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-foreground">
                      <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-0">
                        {s.season_type}
                      </Badge>
                      {s.season_type} {s.year}
                      <span className="ml-auto text-sm font-normal text-green-700 dark:text-green-400">
                        ₹{s.total_charge_qtl}/qtl total
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { label: "Milling", val: s.milling_charge_qtl },
                        { label: "Sortex", val: s.sortex_charge_qtl },
                        { label: "Paddy Transport", val: s.paddy_transport_charge_qtl },
                        { label: "Rice Transport", val: s.rice_transport_charge_qtl },
                        { label: "Blending", val: s.blending_charge_qtl },
                        { label: "Gunny", val: s.gunny_charge_qtl },
                      ].map((c) => (
                        <div key={c.label} className="bg-muted/30 rounded-lg p-2.5">
                          <p className="text-xs text-muted-foreground">{c.label}</p>
                          <p className="font-semibold text-foreground text-sm mt-0.5">₹{c.val}/qtl</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

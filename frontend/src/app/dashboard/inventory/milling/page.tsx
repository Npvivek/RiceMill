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
import { Plus, CheckCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  in_progress: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  planned: "bg-muted text-muted-foreground",
};

export default function MillingRunsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [completeId, setCompleteId] = useState<number | null>(null);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["milling-runs"],
    queryFn: () => api.get("/api/inventory/milling/runs").then((r) => r.data),
  });

  const { data: lots = [] } = useQuery({
    queryKey: ["govt-lots"],
    queryFn: () => api.get("/api/government/lots").then((r) => r.data),
  });

  const createRun = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/inventory/milling/runs", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["milling-runs"] }); toast.success("Milling run created"); setCreateOpen(false); },
    onError: () => toast.error("Failed to create run"),
  });

  const completeRun = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api.patch(`/api/inventory/milling/runs/${id}/complete`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milling-runs"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Run completed — stock updated");
      setCompleteId(null);
    },
    onError: () => toast.error("Failed to complete run"),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createRun.mutate({
      lot_id: fd.get("lot_id") ? Number(fd.get("lot_id")) : null,
      run_date: fd.get("run_date"),
      paddy_input_qtl: Number(fd.get("paddy_input_qtl")),
      shift: fd.get("shift"),
    });
  }

  function handleComplete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!completeId) return;
    const fd = new FormData(e.currentTarget);
    completeRun.mutate({
      id: completeId,
      body: {
        milled_rice_qtl: Number(fd.get("milled_rice_qtl")),
        broken_rice_qtl: Number(fd.get("broken_rice_qtl") || 0),
        bran_qtl: Number(fd.get("bran_qtl") || 0),
        husk_qtl: Number(fd.get("husk_qtl") || 0),
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Milling Runs</h1>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> New Run
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Milling Run</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Government Lot</Label>
              <Select name="lot_id">
                <SelectTrigger><SelectValue placeholder="Select lot (optional)" /></SelectTrigger>
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
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input name="run_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-1.5">
                <Label>Paddy Input (qtl) *</Label>
                <Input name="paddy_input_qtl" type="number" step="0.01" inputMode="decimal" required />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Shift</Label>
                <Select name="shift" defaultValue="day">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={createRun.isPending}>
              {createRun.isPending ? "Creating…" : "Create Run"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={completeId !== null} onOpenChange={(o) => !o && setCompleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Milling Outputs</DialogTitle></DialogHeader>
          <form onSubmit={handleComplete} className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Enter all outputs from this run. By-products will be added to stock.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "milled_rice_qtl", label: "Milled Rice (qtl)", required: true },
                { name: "broken_rice_qtl", label: "Broken Rice (qtl)" },
                { name: "bran_qtl", label: "Bran (qtl)" },
                { name: "husk_qtl", label: "Husk (qtl)" },
              ].map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Input name={f.name} type="number" step="0.01" inputMode="decimal" required={f.required} defaultValue="0" />
                </div>
              ))}
            </div>
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={completeRun.isPending}>
              {completeRun.isPending ? "Saving…" : "Complete & Update Stock"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {["Run #", "Lot", "Date", "Paddy In", "Milled Rice", "Yield %", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.map((r: {
                    id: number; run_number: string; lot_number: string | null; run_date: string;
                    paddy_input_qtl: number; milled_rice_qtl: number | null;
                    yield_pct: number | null; status: string;
                  }) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-amber-700 dark:text-amber-400">{r.run_number}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.lot_number ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmt.date(r.run_date)}</td>
                      <td className="px-4 py-3 text-foreground">{fmt.qtl(r.paddy_input_qtl)}</td>
                      <td className="px-4 py-3 text-foreground">{r.milled_rice_qtl ? fmt.qtl(r.milled_rice_qtl) : "—"}</td>
                      <td className="px-4 py-3 text-foreground">{r.yield_pct ? `${r.yield_pct}%` : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[r.status] ?? ""}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status !== "completed" && (
                          <Button size="sm" variant="outline"
                            className="gap-1 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/40"
                            onClick={() => setCompleteId(r.id)}>
                            <CheckCircle className="w-3.5 h-3.5" /> Complete
                          </Button>
                        )}
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

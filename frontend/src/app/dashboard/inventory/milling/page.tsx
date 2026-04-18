"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, CheckCircle } from "lucide-react";

export default function MillingRunsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [completeId, setCompleteId] = useState<number | null>(null);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["milling-runs"],
    queryFn: () => api.get("/api/inventory/milling/runs").then((r) => r.data),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["paddy-batches"],
    queryFn: () => api.get("/api/inventory/paddy/batches").then((r) => r.data),
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
      toast.success("Milling run completed — stock updated");
      setCompleteId(null);
    },
    onError: () => toast.error("Failed to complete run"),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createRun.mutate({
      paddy_batch_id: Number(fd.get("paddy_batch_id")),
      run_date: fd.get("run_date"),
      paddy_used_qtl: Number(fd.get("paddy_used_qtl")),
      rice_type: fd.get("rice_type"),
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
        machine_hours: fd.get("machine_hours") ? Number(fd.get("machine_hours")) : null,
      },
    });
  }

  const statusColor: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    in_progress: "bg-blue-100 text-blue-800",
    planned: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Milling Runs</h1>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> New Run
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Create Milling Run</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>Paddy Batch</Label>
                <Select name="paddy_batch_id" required>
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {batches.map((b: { id: number; batch_number: string }) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.batch_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input name="run_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Paddy Used (qtl)</Label>
                  <Input name="paddy_used_qtl" type="number" step="0.001" inputMode="decimal" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Rice Type</Label>
                  <Select name="rice_type" defaultValue="raw_rice">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw_rice">Raw Rice</SelectItem>
                      <SelectItem value="boiled_rice">Boiled Rice</SelectItem>
                      <SelectItem value="sona_masoori">Sona Masoori</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
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
      </div>

      {/* Complete Run Dialog */}
      <Dialog open={completeId !== null} onOpenChange={(o) => !o && setCompleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Complete Milling Run</DialogTitle></DialogHeader>
          <form onSubmit={handleComplete} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "milled_rice_qtl", label: "Milled Rice (qtl)", required: true },
                { name: "broken_rice_qtl", label: "Broken Rice (qtl)" },
                { name: "bran_qtl", label: "Bran (qtl)" },
                { name: "husk_qtl", label: "Husk (qtl)" },
                { name: "machine_hours", label: "Machine Hours" },
              ].map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Input name={f.name} type="number" step="0.001" inputMode="decimal" required={f.required} defaultValue="0" />
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
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["Run #", "Date", "Paddy Used", "Milled Rice", "Yield %", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {runs.map((r: {
                    id: number; run_number: string; run_date: string; paddy_used_qtl: number;
                    milled_rice_qtl: number | null; milling_yield_pct: number | null; run_status: string;
                  }) => (
                    <tr key={r.id} className="hover:bg-amber-50">
                      <td className="px-4 py-3 font-medium text-amber-700">{r.run_number}</td>
                      <td className="px-4 py-3 text-gray-600">{fmt.date(r.run_date)}</td>
                      <td className="px-4 py-3">{fmt.qtl(r.paddy_used_qtl)}</td>
                      <td className="px-4 py-3">{r.milled_rice_qtl ? fmt.qtl(r.milled_rice_qtl) : "—"}</td>
                      <td className="px-4 py-3">{r.milling_yield_pct ? `${r.milling_yield_pct}%` : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor[r.run_status] || ""}`}>
                          {r.run_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.run_status !== "completed" && (
                          <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-200 hover:bg-green-50"
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

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
import { Plus, Phone } from "lucide-react";

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/labor/employees").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/labor/employees", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("Employee added"); setOpen(false); },
    onError: () => toast.error("Failed to add employee"),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      name: fd.get("name"),
      phone: fd.get("phone") || null,
      role: fd.get("role") || null,
      wage_type: fd.get("wage_type"),
      wage_rate: Number(fd.get("wage_rate")),
      join_date: fd.get("join_date") || null,
    });
  }

  const roleColor: Record<string, string> = {
    mill_operator: "bg-blue-100 text-blue-700",
    loader: "bg-orange-100 text-orange-700",
    cleaner: "bg-teal-100 text-teal-700",
    driver: "bg-violet-100 text-violet-700",
    supervisor: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Add Employee
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input name="name" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input name="phone" type="tel" inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select name="role">
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mill_operator">Mill Operator</SelectItem>
                      <SelectItem value="loader">Loader</SelectItem>
                      <SelectItem value="cleaner">Cleaner</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Wage Type</Label>
                  <Select name="wage_type" defaultValue="daily">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="piece_rate">Piece Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Wage Rate (₹)</Label>
                  <Input name="wage_rate" type="number" step="0.01" inputMode="decimal" required />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Join Date</Label>
                  <Input name="join_date" type="date" />
                </div>
              </div>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Add Employee"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : employees.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">No employees yet</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(employees as { id: number; name: string; phone: string | null; role: string | null; wage_type: string; wage_rate: number }[]).map((emp) => (
            <Card key={emp.id} className="hover:border-amber-300 transition-colors">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-gray-900">{emp.name}</p>
                  {emp.role && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${roleColor[emp.role] || "bg-gray-100 text-gray-600"}`}>
                      {emp.role.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                {emp.phone && (
                  <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
                    <Phone className="w-3.5 h-3.5" /> {emp.phone}
                  </div>
                )}
                <div className="mt-2 text-sm text-gray-600">
                  <span className="capitalize">{emp.wage_type.replace(/_/g, " ")}</span>
                  {" — "}
                  <span className="font-medium">{fmt.currency(emp.wage_rate)}</span>
                  <span className="text-gray-400 text-xs">
                    {emp.wage_type === "daily" ? "/day" : emp.wage_type === "monthly" ? "/month" : "/unit"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

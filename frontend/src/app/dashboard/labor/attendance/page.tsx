"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

type AttendanceStatus = "present" | "absent" | "half_day" | "paid_leave";

interface EmpAttendance {
  employee_id: number;
  name: string;
  status: AttendanceStatus;
  overtime_hours: number;
}

export default function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const qc = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/labor/employees").then((r) => r.data),
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: () => api.get(`/api/labor/attendance?attendance_date=${date}`).then((r) => r.data),
    enabled: !!date,
  });

  const existingMap: Record<number, { status: string; overtime_hours: number }> = {};
  (existing as { employee_id: number; status: string; overtime_hours: number }[]).forEach((r) => {
    existingMap[r.employee_id] = r;
  });

  const [entries, setEntries] = useState<Record<number, EmpAttendance>>({});

  const allEntries: EmpAttendance[] = (employees as { id: number; name: string }[]).map((emp) => {
    const override = entries[emp.id];
    const saved = existingMap[emp.id];
    return {
      employee_id: emp.id,
      name: emp.name,
      status: override?.status ?? (saved?.status as AttendanceStatus) ?? "present",
      overtime_hours: override?.overtime_hours ?? saved?.overtime_hours ?? 0,
    };
  });

  const save = useMutation({
    mutationFn: () =>
      api.post("/api/labor/attendance/bulk", {
        attendance_date: date,
        entries: allEntries.map((e) => ({
          employee_id: e.employee_id,
          status: e.status,
          shift: "day",
          overtime_hours: e.overtime_hours,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", date] });
      toast.success(`Attendance saved for ${date}`);
      setEntries({});
    },
    onError: () => toast.error("Failed to save attendance"),
  });

  function update(empId: number, field: keyof EmpAttendance, value: string | number) {
    setEntries((prev) => ({
      ...prev,
      [empId]: { ...allEntries.find((e) => e.employee_id === empId)!, [field]: value },
    }));
  }

  const statusColor: Record<AttendanceStatus, string> = {
    present: "bg-green-100 text-green-700 border-green-200",
    absent: "bg-red-100 text-red-700 border-red-200",
    half_day: "bg-yellow-100 text-yellow-700 border-yellow-200",
    paid_leave: "bg-blue-100 text-blue-700 border-blue-200",
  };

  const presentCount = allEntries.filter((e) => e.status === "present" || e.status === "half_day").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">{presentCount} / {employees.length} present</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          <Button className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => save.mutate()} disabled={save.isPending || employees.length === 0}>
            <Save className="w-4 h-4" /> {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {employees.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">No employees — add employees first</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {allEntries.map((entry) => (
            <Card key={entry.employee_id} className={`border ${statusColor[entry.status]}`}>
              <CardContent className="py-3 px-4 flex items-center gap-3 flex-wrap">
                <p className="font-medium text-gray-900 w-36 shrink-0">{entry.name}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(["present", "absent", "half_day", "paid_leave"] as AttendanceStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update(entry.employee_id, "status", s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                        entry.status === s
                          ? statusColor[s] + " ring-1 ring-current"
                          : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Label className="text-xs text-gray-500 whitespace-nowrap">OT hrs</Label>
                  <Input
                    type="number" step="0.5" inputMode="decimal"
                    className="w-16 h-7 text-xs"
                    value={entry.overtime_hours || ""}
                    onChange={(e) => update(entry.employee_id, "overtime_hours", Number(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Phone, MapPin } from "lucide-react";

export default function PartiesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");

  const { data: parties = [], isLoading } = useQuery({
    queryKey: ["parties", tab],
    queryFn: () => api.get(`/api/parties/${tab !== "all" ? `?party_type=${tab}` : ""}`).then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/parties/", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parties"] });
      toast.success("Party added");
      setOpen(false);
    },
    onError: () => toast.error("Failed to add party"),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      name: fd.get("name"),
      phone: fd.get("phone") || null,
      address: fd.get("address") || null,
      village: fd.get("village") || null,
      district: fd.get("district") || null,
      party_type: fd.get("party_type"),
      gstin: fd.get("gstin") || null,
    });
  }

  const typeColor: Record<string, string> = {
    supplier: "bg-blue-100 text-blue-800",
    customer: "bg-green-100 text-green-800",
    both: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Parties</h1>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Add Party
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Party</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Name *</Label>
                  <Input name="name" required placeholder="Full name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Type *</Label>
                  <Select name="party_type" required>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplier">Farmer (Supplier)</SelectItem>
                      <SelectItem value="customer">Buyer (Customer)</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input name="phone" type="tel" inputMode="numeric" placeholder="9876543210" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Village</Label>
                  <Input name="village" placeholder="Village name" />
                </div>
                <div className="space-y-1.5">
                  <Label>District</Label>
                  <Input name="district" defaultValue="Krishna" />
                </div>
                <div className="space-y-1.5">
                  <Label>GSTIN</Label>
                  <Input name="gstin" placeholder="Optional" />
                </div>
              </div>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Add Party"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="supplier">Farmers</TabsTrigger>
          <TabsTrigger value="customer">Buyers</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : parties.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-400">No parties found</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {parties.map((p: { id: number; name: string; phone: string | null; village: string | null; district: string | null; party_type: string }) => (
                <Card key={p.id} className="hover:border-amber-300 transition-colors cursor-pointer">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 leading-tight">{p.name}</p>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${typeColor[p.party_type] || ""}`}>
                        {p.party_type === "supplier" ? "Farmer" : p.party_type === "customer" ? "Buyer" : "Both"}
                      </span>
                    </div>
                    {p.phone && (
                      <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
                        <Phone className="w-3.5 h-3.5" /> {p.phone}
                      </div>
                    )}
                    {(p.village || p.district) && (
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-400">
                        <MapPin className="w-3.5 h-3.5" />
                        {[p.village, p.district].filter(Boolean).join(", ")}
                      </div>
                    )}
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

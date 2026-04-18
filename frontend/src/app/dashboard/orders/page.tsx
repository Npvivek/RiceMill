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
import { Plus, Trash2, IndianRupee } from "lucide-react";

type OrderItem = { rice_type: string; grade: string; quantity_qtl: number; price_per_qtl: number };

export default function OrdersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("orders");
  const [orderOpen, setOrderOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([{ rice_type: "raw_rice", grade: "A", quantity_qtl: 0, price_per_qtl: 0 }]);

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get("/api/orders/orders").then((r) => r.data),
  });

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get("/api/orders/invoices").then((r) => r.data),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["parties-customers"],
    queryFn: () => api.get("/api/parties/?party_type=customer").then((r) => r.data),
  });

  const createOrder = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/orders/orders", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Order created with invoice");
      setOrderOpen(false);
      setItems([{ rice_type: "raw_rice", grade: "A", quantity_qtl: 0, price_per_qtl: 0 }]);
    },
    onError: () => toast.error("Failed to create order"),
  });

  const recordPayment = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/api/orders/payments", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Payment recorded");
      setPayOpen(false);
    },
    onError: () => toast.error("Failed to record payment"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/api/orders/orders/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Status updated");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed";
      toast.error(msg);
    },
  });

  function handleCreateOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createOrder.mutate({
      customer_id: Number(fd.get("customer_id")),
      order_date: fd.get("order_date"),
      transport_charge: Number(fd.get("transport_charge") || 0),
      vehicle_number: fd.get("vehicle_number") || null,
      items: items.map((it) => ({
        rice_type: it.rice_type,
        grade: it.grade,
        quantity_qtl: it.quantity_qtl,
        price_per_qtl: it.price_per_qtl,
        amount: it.quantity_qtl * it.price_per_qtl,
      })),
    });
  }

  function handlePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    recordPayment.mutate({
      invoice_id: Number(fd.get("invoice_id")),
      payment_date: fd.get("payment_date"),
      amount: Number(fd.get("amount")),
      payment_mode: fd.get("payment_mode"),
      reference_number: fd.get("reference_number") || null,
    });
  }

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    dispatched: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const nextStatus: Record<string, string> = {
    pending: "confirmed", confirmed: "dispatched", dispatched: "delivered",
  };

  const orderSubtotal = items.reduce((s, i) => s + i.quantity_qtl * i.price_per_qtl, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orders & Billing</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPayOpen(true)}>
            <IndianRupee className="w-4 h-4" /> Record Payment
          </Button>
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <form onSubmit={handlePayment} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Invoice</Label>
                  <Select name="invoice_id" required>
                    <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                    <SelectContent>
                      {(invoices as { id: number; invoice_number: string; balance_due: number; status: string }[])
                        .filter((i) => i.status !== "paid")
                        .map((i) => (
                          <SelectItem key={i.id} value={String(i.id)}>
                            {i.invoice_number} — Due: {fmt.currency(i.balance_due)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input name="payment_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (₹)</Label>
                    <Input name="amount" type="number" step="0.01" inputMode="decimal" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mode</Label>
                    <Select name="payment_mode" defaultValue="cash">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ref # (optional)</Label>
                    <Input name="reference_number" />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={recordPayment.isPending}>
                  {recordPayment.isPending ? "Saving…" : "Record Payment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => setOrderOpen(true)}>
            <Plus className="w-4 h-4" /> New Order
          </Button>
          <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Order</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateOrder} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Customer *</Label>
                    <Select name="customer_id" required>
                      <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                      <SelectContent>
                        {(customers as { id: number; name: string }[]).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input name="order_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Transport (₹)</Label>
                    <Input name="transport_charge" type="number" step="0.01" defaultValue="0" inputMode="decimal" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Vehicle No.</Label>
                    <Input name="vehicle_number" placeholder="AP 31 AB 1234" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Items</Label>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => setItems([...items, { rice_type: "raw_rice", grade: "A", quantity_qtl: 0, price_per_qtl: 0 }])}>
                      + Add Item
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-5 gap-2 items-end p-2 bg-gray-50 rounded-lg">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Rice Type</Label>
                          <Select value={item.rice_type}
                            onValueChange={(v) => v && setItems(items.map((it, i) => i === idx ? { ...it, rice_type: v } : it))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="raw_rice">Raw Rice</SelectItem>
                              <SelectItem value="boiled_rice">Boiled Rice</SelectItem>
                              <SelectItem value="sona_masoori">Sona Masoori</SelectItem>
                              <SelectItem value="broken_rice">Broken Rice</SelectItem>
                              <SelectItem value="bran">Bran</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Qty (qtl)</Label>
                          <Input className="h-8 text-xs" type="number" step="0.001" inputMode="decimal" value={item.quantity_qtl || ""}
                            onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, quantity_qtl: Number(e.target.value) } : it))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">₹/qtl</Label>
                          <Input className="h-8 text-xs" type="number" step="0.01" inputMode="decimal" value={item.price_per_qtl || ""}
                            onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, price_per_qtl: Number(e.target.value) } : it))} />
                        </div>
                        <div className="flex items-end pb-0.5">
                          {items.length > 1 && (
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600"
                              onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {orderSubtotal > 0 && (
                    <p className="text-right text-sm font-semibold text-gray-700 mt-2">
                      Subtotal: {fmt.currency(orderSubtotal)}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={createOrder.isPending}>
                  {createOrder.isPending ? "Creating…" : "Create Order + Invoice"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Order #", "Date", "Customer", "Status", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ordersLoading
                      ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>)
                      : (orders as { id: number; order_number: string; order_date: string; customer?: { name: string }; status: string }[]).map((o) => (
                        <tr key={o.id} className="hover:bg-amber-50">
                          <td className="px-4 py-3 font-medium text-amber-700">{o.order_number}</td>
                          <td className="px-4 py-3 text-gray-600">{fmt.date(o.order_date)}</td>
                          <td className="px-4 py-3 text-gray-700">{o.customer?.name || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor[o.status] || ""}`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {nextStatus[o.status] && (
                              <Button size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => updateStatus.mutate({ id: o.id, status: nextStatus[o.status] })}>
                                → {nextStatus[o.status]}
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
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["Invoice #", "Date", "Total", "Paid", "Balance Due", "Status"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invLoading
                      ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>)
                      : (invoices as { id: number; invoice_number: string; invoice_date: string; total_amount: number; amount_paid: number; balance_due: number; status: string }[]).map((inv) => (
                        <tr key={inv.id} className="hover:bg-amber-50">
                          <td className="px-4 py-3 font-medium text-amber-700">{inv.invoice_number}</td>
                          <td className="px-4 py-3 text-gray-600">{fmt.date(inv.invoice_date)}</td>
                          <td className="px-4 py-3 font-medium">{fmt.currency(inv.total_amount)}</td>
                          <td className="px-4 py-3 text-green-700">{fmt.currency(inv.amount_paid)}</td>
                          <td className="px-4 py-3 text-red-600 font-medium">{fmt.currency(inv.balance_due)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                              inv.status === "paid" ? "bg-green-100 text-green-800" :
                              inv.status === "partial" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

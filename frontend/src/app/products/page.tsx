import Link from "next/link";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

async function getPriceList() {
  try {
    const res = await api.get("/api/public/pricing");
    return res.data as { id: number; rice_type: string; grade: string; price_per_qtl: number }[];
  } catch {
    return [];
  }
}

const riceInfo: Record<string, { fullName: string; desc: string }> = {
  raw_rice: { fullName: "Raw Rice", desc: "Standard milled rice" },
  boiled_rice: { fullName: "Boiled Rice (Par-boiled)", desc: "Parboiled for better nutrition" },
  sona_masoori: { fullName: "BPT 5204 — Sona Masoori", desc: "Premium thin-grain variety, highest demand in AP" },
  broken_rice: { fullName: "Broken Rice", desc: "For flour mills and poultry feed" },
  bran: { fullName: "Rice Bran", desc: "Sold to oil extraction units" },
  husk: { fullName: "Rice Husk", desc: "Biomass fuel for boilers" },
};

export default async function ProductsPage() {
  const prices = await getPriceList();

  return (
    <div className="min-h-screen bg-amber-50">
      <nav className="sticky top-0 z-10 bg-white border-b border-amber-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="w-4 h-4" /> Back</Button></Link>
          <div>
            <p className="font-bold text-sm text-amber-900">Products & Pricing</p>
            <p className="text-xs text-amber-600">Panduranga Rice Mill</p>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-amber-900 mb-2">Current Prices</h1>
        <p className="text-sm text-amber-700 mb-1">All prices in ₹ per quintal (100 kg). Subject to change — call to confirm.</p>
        <p className="text-xs text-gray-400 mb-8">Minimum order: 10 quintals for delivery</p>

        {prices.length > 0 ? (
          <div className="grid gap-3">
            {prices.map((p) => {
              const info = riceInfo[p.rice_type] || { fullName: p.rice_type.replace(/_/g, " "), desc: "" };
              return (
                <Card key={p.id} className="border-amber-200">
                  <CardContent className="py-4 px-5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{info.fullName}</p>
                      {info.desc && <p className="text-xs text-gray-500 mt-0.5">{info.desc}</p>}
                      <Badge variant="outline" className="text-xs mt-1.5">Grade {p.grade}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-700">
                        ₹{new Intl.NumberFormat("en-IN").format(p.price_per_qtl)}
                      </p>
                      <p className="text-xs text-gray-400">per quintal</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-amber-200">
            <CardContent className="py-10 text-center">
              <p className="text-amber-700 font-medium">Pricing not yet published</p>
              <p className="text-sm text-gray-500 mt-1">Call or WhatsApp us for current rates</p>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <p className="font-semibold text-gray-800">Need a bulk quote?</p>
          <p className="text-sm text-gray-500 mt-1">WhatsApp us your requirements and we&apos;ll get back within the hour</p>
          <a href="https://wa.me/91XXXXXXXXXX?text=Hi,%20I%20need%20pricing%20for%20bulk%20rice" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block">
            <Button className="bg-green-600 hover:bg-green-700">💬 WhatsApp for Quote</Button>
          </a>
        </div>
      </div>
    </div>
  );
}

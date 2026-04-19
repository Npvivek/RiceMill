import Link from "next/link";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

async function getPriceList() {
  try {
    const res = await api.get("/api/public/pricing");
    return res.data as { id: number; rice_type: string; grade: string; price_per_qtl: number }[];
  } catch {
    return [];
  }
}

const SOLD_PRODUCTS = ["broken_rice", "bran", "husk"];

const riceInfo: Record<string, { fullName: string; desc: string }> = {
  broken_rice: { fullName: "Broken Rice", desc: "For flour mills, poultry feed, and starch production" },
  bran: { fullName: "Rice Bran", desc: "Sold to oil extraction units — also used as animal feed supplement" },
  husk: { fullName: "Rice Husk", desc: "Biomass fuel for boilers and brick kilns" },
};

export default async function ProductsPage() {
  const allPrices = await getPriceList();
  const prices = allPrices.filter((p) => SOLD_PRODUCTS.includes(p.rice_type));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            </Link>
            <div className="border-l border-border pl-3">
              <p className="font-bold text-sm text-amber-800 dark:text-amber-300">Products & Pricing</p>
              <p className="text-xs text-muted-foreground">Panduranga Rice Mill</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-1">Current Prices</h1>
        <p className="text-sm text-muted-foreground mb-1">All prices in ₹ per quintal (100 kg). Subject to change — call to confirm.</p>
        <p className="text-xs text-muted-foreground mb-8">Minimum order: 10 quintals for delivery</p>

        {prices.length > 0 ? (
          <div className="grid gap-3">
            {prices.map((p) => {
              const info = riceInfo[p.rice_type] ?? { fullName: p.rice_type.replace(/_/g, " "), desc: "" };
              return (
                <Card key={p.id} className="border-border hover:border-amber-400 dark:hover:border-amber-600 transition-colors bg-card">
                  <CardContent className="py-4 px-5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{info.fullName}</p>
                      {info.desc && <p className="text-xs text-muted-foreground mt-0.5">{info.desc}</p>}
                      <Badge variant="outline" className="text-xs mt-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                        Grade {p.grade}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                        ₹{new Intl.NumberFormat("en-IN").format(p.price_per_qtl)}
                      </p>
                      <p className="text-xs text-muted-foreground">per quintal</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {Object.entries(riceInfo).map(([key, info]) => (
              <Card key={key} className="border-border bg-card">
                <CardContent className="py-4 px-5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{info.fullName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{info.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Call for price</p>
                    <p className="text-xs text-muted-foreground">per quintal</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl p-5 text-center">
          <p className="font-semibold text-foreground">Need a bulk quote?</p>
          <p className="text-sm text-muted-foreground mt-1">WhatsApp us your requirements and we&apos;ll get back within the hour</p>
          <a
            href="https://wa.me/919703022892?text=Hi,%20I%20need%20pricing%20for%20bulk%20mill%20by-products"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block"
          >
            <Button className="bg-green-600 hover:bg-green-700">💬 WhatsApp for Quote</Button>
          </a>
        </div>
      </div>
    </div>
  );
}

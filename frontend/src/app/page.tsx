import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, Wheat, ArrowRight, Package, Flame, CheckCircle, Scale, Shield, Droplets, ShieldCheck, Receipt, Landmark, Factory, Award } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FloatingWhatsApp } from "@/components/ui/whatsapp-button";

const products = [
  {
    name: "Broken Rice",
    icon: Package,
    desc: "Suitable for flour mills, poultry feed, and starch production. Available in large quantities.",
    uses: ["Flour mills", "Poultry feed", "Starch production"],
    badge: "High Demand",
  },
  {
    name: "Rice Husk",
    icon: Flame,
    desc: "Clean-burning biomass fuel used in boilers and brick kilns. High calorific value.",
    uses: ["Boiler fuel", "Brick kilns", "Biomass energy"],
    badge: "Bulk Available",
  },
  {
    name: "Rice Bran",
    icon: Droplets,
    desc: "Rich oil-bearing by-product sold to extraction units. Also used as animal feed supplement.",
    uses: ["Bran oil extraction", "Animal feed", "Nutraceuticals"],
    badge: "By-Product",
  },
];

const paddyBenefits = [
  "Rates competitive with or above govt MSP",
  "Same-day or next-day payment",
  "No long queues or paperwork hassle",
  "Licensed WeighBridge — certified fair weighing",
  "Fair moisture testing on every batch",
  "All varieties accepted — BPT, MTU, Rajanna",
];

const certifications = [
  { icon: ShieldCheck, label: "FSSAI Licensed", sub: "Food Safety & Standards Authority of India", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
  { icon: Receipt, label: "GST Registered", sub: "Goods & Services Tax — Compliant Business", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/30" },
  { icon: Scale, label: "WeighBridge Certified", sub: "Officially Licensed Weighbridge — Fair & Recorded", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30" },
  { icon: Landmark, label: "DCSO Authorized", sub: "District Civil Supplies Office — Govt Milling Approved", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/30" },
  { icon: Factory, label: "Factory Licensed", sub: "Registered Manufacturing Unit under Factories Act", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/30" },
  { icon: Award, label: "Udyam Registered", sub: "MSME — Ministry of MSME, Govt of India", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/30" },
];

const trustPoints = [
  { icon: Wheat, title: "Modern Milling", desc: "High-efficiency machinery for quality output and minimal waste" },
  { icon: Scale, title: "Fair Dealing", desc: "Transparent weighing and moisture testing — always done openly" },
  { icon: Shield, title: "Family Business", desc: "Decades of trust in Hanuman Junction — your neighbors, not strangers" },
  { icon: CheckCircle, title: "Reliable Supply", desc: "Consistent stock of broken rice, husk, and bran year-round" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🌾</span>
            <div>
              <p className="font-bold text-sm leading-tight text-amber-800 dark:text-amber-300">Panduranga Rice Mill</p>
              <p className="text-xs text-muted-foreground">Hanuman Junction, Eluru</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/products" className="text-sm text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 hidden sm:block transition-colors px-2">Products</Link>
            <a href="/contact" className="text-sm text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 hidden sm:block transition-colors px-2">Contact</a>
            <ThemeToggle />
            <Link href="/dashboard">
              <Button size="sm" variant="outline" className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 ml-1">
                Mill Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-amber-900/20 px-4 py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 dark:opacity-5 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #b45309 0%, transparent 50%), radial-gradient(circle at 80% 20%, #92400e 0%, transparent 40%)" }}
        />
        <div className="max-w-5xl mx-auto text-center relative">
          <Badge className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 mb-5">
            Est. in Hanuman Junction, AP
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-amber-900 dark:text-amber-100 leading-tight tracking-tight">
            Quality Mill By-Products.<br />
            <span className="text-amber-600 dark:text-amber-400">Fair Paddy Rates.</span>
          </h1>
          <p className="mt-5 text-base md:text-lg text-amber-800/80 dark:text-amber-300/90 max-w-lg mx-auto leading-relaxed">
            We sell broken rice, husk, and bran at wholesale rates — and we&apos;re actively procuring paddy from farmers and traders within Eluru district.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link href="/products">
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 w-full sm:w-auto gap-2">
                View Products & Prices <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#sell-paddy">
              <Button size="lg" variant="outline" className="border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/60 w-full sm:w-auto">
                🌾 Sell Paddy to Us
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-b border-border bg-muted/20 px-4 py-5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { val: "30+", label: "Years in Business" },
            { val: "3", label: "Products We Sell" },
            { val: "Eluru", label: "District Served" },
            { val: "Direct", label: "From the Mill" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xl md:text-2xl font-bold text-amber-700 dark:text-amber-400">{s.val}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Certifications */}
      <section className="bg-muted/30 border-y border-border px-4 py-14">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <CheckCircle className="w-3.5 h-3.5" /> Licensed & Registered
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Licensed. Verified. Trusted.</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
              Panduranga Rice Mill holds government licences and registrations — so you know you&apos;re dealing with a compliant, accountable business.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {certifications.map((c) => (
              <div key={c.label} className="flex items-start gap-4 bg-background rounded-2xl border border-border p-5 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md transition-all">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-semibold text-foreground text-sm">{c.label}</p>
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products We Sell */}
      <section className="px-4 py-14 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-amber-900 dark:text-amber-100">What We Sell</h2>
          <p className="text-muted-foreground text-sm mt-2">Mill by-products available at wholesale rates. Minimum order quantities apply.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {products.map((p) => (
            <Card key={p.name} className="border-border hover:border-amber-400 dark:hover:border-amber-600 transition-all hover:shadow-lg group bg-card">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/60 transition-colors">
                  <p.icon className="w-6 h-6 text-amber-700 dark:text-amber-400" />
                </div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-foreground">{p.name}</h3>
                  <Badge variant="secondary" className="text-xs shrink-0 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-0">
                    {p.badge}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{p.desc}</p>
                <div className="space-y-1.5">
                  {p.uses.map((u) => (
                    <div key={u} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                      {u}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="text-center mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/products">
            <Button className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600">
              See Current Prices
            </Button>
          </Link>
          <a href="https://wa.me/919703022892?text=Hi,%20I%20need%20pricing%20for%20mill%20by-products" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="border-green-500 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40">
              💬 WhatsApp for Bulk Quote
            </Button>
          </a>
        </div>
      </section>

      {/* Sell Paddy to Us */}
      <section id="sell-paddy" className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 px-4 py-14 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <Badge className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700 mb-4">
                For Paddy Farmers & Traders
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 leading-tight">
                Sell Your Paddy<br />
                <span className="text-green-700 dark:text-green-400">Directly to the Mill</span>
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                We are actively procuring paddy from farmers and traders within Eluru district. Get fair rates, clear terms, and a direct relationship with the mill.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-8">
                {paddyBenefits.map((b) => (
                  <div key={b} className="flex items-start gap-2 text-sm text-foreground/80">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    {b}
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="https://wa.me/919703022892?text=Hi,%20I%20want%20to%20sell%20paddy%20to%20your%20mill" target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 w-full sm:w-auto">
                    💬 WhatsApp to Sell Paddy
                  </Button>
                </a>
                <Link href="/contact">
                  <Button size="lg" variant="outline" className="border-green-400 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 w-full sm:w-auto">
                    Send Enquiry
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "Fair Pricing", desc: "Ask us for today's procurement rate before dispatch.", icon: "💰" },
                { title: "Quick Payment", desc: "Payment terms are confirmed clearly with the mill.", icon: "⚡" },
                { title: "Local Varieties", desc: "BPT, MTU, Rajanna, and other local varieties.", icon: "🌾" },
                { title: "Certified WeighBridge", desc: "Licensed & official — your weight is recorded accurately.", icon: "⚖️" },
              ].map((item) => (
                <div key={item.title} className="bg-background border border-border rounded-xl p-4 hover:border-green-400 dark:hover:border-green-700 transition-colors">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <p className="font-semibold text-sm text-foreground mb-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="px-4 py-14 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100">Why Choose Us</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {trustPoints.map((f) => (
            <div key={f.title} className="text-center p-3">
              <div className="w-11 h-11 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
                <f.icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="font-semibold text-foreground text-sm">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact strip */}
      <section className="bg-amber-900 dark:bg-amber-950/80 border-t border-amber-800 dark:border-amber-900 px-4 py-12 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Get in Touch</h2>
        <p className="text-amber-200/80 text-sm mb-6">For bulk orders, pricing enquiries, or to sell paddy</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6 text-amber-200">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-amber-400" />
            <span>+91 97030 22892</span>
          </div>
          <div className="hidden sm:block text-amber-700">|</div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Hanuman Junction, Eluru District, AP</span>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <Link href="/contact">
            <Button variant="outline" className="border-amber-500 text-amber-100 bg-transparent hover:bg-amber-800 dark:hover:bg-amber-900/60">
              Contact Form
            </Button>
          </Link>
          <a href="https://wa.me/919703022892" target="_blank" rel="noopener noreferrer">
            <Button className="bg-green-600 hover:bg-green-700">💬 WhatsApp</Button>
          </a>
        </div>
      </section>

      <FloatingWhatsApp />

      {/* Footer */}
      <footer className="bg-amber-950 dark:bg-black/80 text-amber-400 px-4 py-6 text-center text-sm">
        <p className="font-semibold text-white">Panduranga Rice Mill</p>
        <p className="mt-1 text-amber-500">Hanuman Junction, Eluru District, Andhra Pradesh</p>
        <p className="mt-2 text-amber-700 text-xs">© {new Date().getFullYear()} All rights reserved</p>
      </footer>

    </div>
  );
}

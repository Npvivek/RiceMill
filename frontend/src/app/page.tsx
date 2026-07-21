import Link from "next/link";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Droplets,
  Factory,
  Flame,
  Landmark,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  Scale,
  ShieldCheck,
  Wheat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FloatingWhatsApp } from "@/components/ui/whatsapp-button";
import { BrandMark } from "@/components/marketing/brand-mark";
import { MillFlowVisual } from "@/components/marketing/mill-flow-visual";

const products = [
  {
    name: "Broken rice",
    icon: Package,
    eyebrow: "Food & feed",
    description: "Consistent mill-grade broken rice for flour mills, poultry feed, and starch processing.",
    tone: "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/25 dark:text-amber-100",
    iconTone: "bg-amber-200/70 text-amber-800 dark:bg-amber-900/70 dark:text-amber-300",
  },
  {
    name: "Rice bran",
    icon: Droplets,
    eyebrow: "Oil & nutrition",
    description: "Fresh rice bran supplied to extraction units and animal-feed businesses in bulk lots.",
    tone: "border-orange-300/70 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/25 dark:text-orange-100",
    iconTone: "bg-orange-200/70 text-orange-800 dark:bg-orange-900/70 dark:text-orange-300",
  },
  {
    name: "Rice husk",
    icon: Flame,
    eyebrow: "Biomass fuel",
    description: "Dry rice husk for boilers, brick kilns, and other biomass applications.",
    tone: "border-stone-300 bg-stone-100 text-stone-950 dark:border-stone-700 dark:bg-stone-900/70 dark:text-stone-100",
    iconTone: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300",
  },
];

const certifications = [
  { icon: ShieldCheck, label: "FSSAI licensed" },
  { icon: Receipt, label: "GST registered" },
  { icon: Scale, label: "Certified weighbridge" },
  { icon: Landmark, label: "DCSO authorized" },
  { icon: Factory, label: "Factory licensed" },
  { icon: Award, label: "Udyam registered" },
];

const paddyBenefits = [
  "Today’s procurement rate confirmed before delivery",
  "Licensed weighbridge with transparent weighing",
  "Moisture checked in front of the supplier",
  "Prompt payment after quality and weight confirmation",
  "BPT, MTU, Rajanna, and other local varieties",
  "Direct relationship with the mill team",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#fbfaf6] text-stone-950 dark:bg-[#0c0d0b] dark:text-stone-100">
      <nav className="sticky top-0 z-50 border-b border-amber-950/10 bg-[#fbfaf6]/90 px-4 py-3 backdrop-blur-xl dark:border-amber-100/10 dark:bg-[#0c0d0b]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="group flex items-center gap-3" aria-label="Panduranga Rice Mill home">
            <BrandMark className="h-9 w-9 text-amber-600 transition-transform duration-300 group-hover:-rotate-3 dark:text-amber-400" />
            <div>
              <p className="font-mill-display text-sm font-black uppercase leading-none tracking-[0.08em] text-stone-900 dark:text-amber-100">Panduranga Rice Mill</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">Hanuman Junction · Eluru</p>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="#products" className="hidden px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:text-amber-700 md:block dark:text-stone-300 dark:hover:text-amber-300">Products</Link>
            <Link href="#paddy" className="hidden px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:text-amber-700 md:block dark:text-stone-300 dark:hover:text-amber-300">Sell paddy</Link>
            <Link href="/contact" className="hidden px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:text-amber-700 sm:block dark:text-stone-300 dark:hover:text-amber-300">Contact</Link>
            <ThemeToggle />
            <Link href="/dashboard">
              <Button size="sm" variant="outline" className="ml-1 border-amber-500/50 bg-transparent text-amber-800 hover:bg-amber-100 dark:border-amber-600/60 dark:text-amber-300 dark:hover:bg-amber-950/60">
                Mill dashboard
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="mill-noise relative overflow-hidden bg-[#13130f] px-4 py-14 text-stone-100 md:py-20 lg:py-24">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
          <div className="absolute -left-40 top-20 h-80 w-80 rounded-full bg-emerald-900/20 blur-3xl" />
          <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.03fr_.97fr] lg:gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 border-l-2 border-amber-400 bg-amber-400/8 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
                <MapPin className="h-3.5 w-3.5" /> Hanuman Junction · Eluru district
              </div>

              <h1 className="font-mill-display mt-7 text-5xl font-black uppercase leading-[.92] tracking-[-0.035em] text-[#fff7df] sm:text-6xl lg:text-[4.8rem]">
                Paddy in.
                <span className="mt-2 block text-amber-400">Value out.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-stone-300 sm:text-lg">
                Wholesale broken rice, bran, and husk—milled locally and supplied across Eluru district. We also procure paddy directly from farmers and traders within the district.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="#products">
                  <Button size="lg" className="w-full gap-2 bg-amber-500 font-bold text-stone-950 shadow-[0_12px_40px_rgba(245,158,11,.18)] hover:bg-amber-400 sm:w-auto">
                    Explore our products <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="https://wa.me/919703022892?text=Hi,%20I%20want%20to%20sell%20paddy%20to%20Panduranga%20Rice%20Mill" target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline" className="w-full gap-2 border-stone-600 bg-transparent text-stone-100 hover:border-emerald-500 hover:bg-emerald-950/40 sm:w-auto">
                    <Wheat className="h-4 w-4" /> Sell paddy to us
                  </Button>
                </a>
              </div>

              <div className="mt-10 grid max-w-xl grid-cols-3 border-y border-stone-700/70 py-4">
                <div>
                  <p className="font-mill-display text-2xl font-black text-amber-300">30+</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">Years local</p>
                </div>
                <div className="border-x border-stone-700/70 px-5">
                  <p className="font-mill-display text-2xl font-black text-amber-300">3</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">By-products</p>
                </div>
                <div className="pl-5">
                  <p className="font-mill-display text-2xl font-black text-amber-300">Eluru</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">Service district</p>
                </div>
              </div>
            </div>

            <div className="relative lg:pl-4">
              <MillFlowVisual />
            </div>
          </div>
        </section>

        <section className="border-b border-amber-950/10 bg-amber-400 px-4 py-4 text-stone-950 dark:border-amber-300/10 dark:bg-amber-500">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-xs font-black uppercase tracking-[0.15em] sm:gap-x-7">
            <span>Paddy received</span><ArrowRight className="h-3.5 w-3.5" />
            <span>Weighed & tested</span><ArrowRight className="h-3.5 w-3.5" />
            <span>Milled efficiently</span><ArrowRight className="h-3.5 w-3.5" />
            <span>Products supplied</span>
          </div>
        </section>

        <section id="products" className="scroll-mt-20 px-4 py-16 md:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-end gap-5 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">Mill output · bulk supply</p>
                <h2 className="font-mill-display mt-3 max-w-2xl text-4xl font-black uppercase leading-none tracking-[-0.025em] text-stone-900 sm:text-5xl dark:text-stone-100">Three useful products. Zero wasted potential.</h2>
              </div>
              <Link href="/products" className="inline-flex items-center gap-2 text-sm font-bold text-amber-800 hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200">
                Availability & pricing <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {products.map((product, index) => (
                <article key={product.name} className={`group relative overflow-hidden rounded-2xl border p-6 transition-transform duration-300 hover:-translate-y-1 ${product.tone}`}>
                  <span className="absolute right-5 top-4 font-mill-display text-5xl font-black text-current opacity-[.06]">0{index + 1}</span>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${product.iconTone}`}>
                    <product.icon className="h-6 w-6" />
                  </div>
                  <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] opacity-55">{product.eyebrow}</p>
                  <h3 className="font-mill-display mt-2 text-2xl font-black uppercase tracking-tight">{product.name}</h3>
                  <p className="mt-3 text-sm leading-6 opacity-70">{product.description}</p>
                  <a href="https://wa.me/919703022892?text=Hi,%20I%20need%20today's%20price%20and%20availability" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] underline decoration-current/30 underline-offset-4">
                    Ask today&apos;s rate <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="paddy" className="scroll-mt-20 px-4 pb-16 md:pb-24">
          <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] bg-[#173b29] text-white shadow-[0_30px_80px_rgba(20,50,34,.18)] lg:grid-cols-[.92fr_1.08fr]">
            <div className="relative overflow-hidden border-b border-white/10 p-8 sm:p-12 lg:border-b-0 lg:border-r">
              <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full border-[40px] border-emerald-300/5" />
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">For Eluru district farmers & traders</p>
              <h2 className="font-mill-display mt-4 text-4xl font-black uppercase leading-[.98] tracking-[-0.02em] sm:text-5xl">Sell paddy directly to the mill.</h2>
              <p className="mt-5 max-w-lg text-sm leading-6 text-emerald-50/70">
                Call before dispatch to confirm today&apos;s rate, accepted variety, moisture expectations, and delivery time. Clear terms before the load moves.
              </p>
              <a href="https://wa.me/919703022892?text=Hi,%20I%20have%20paddy%20to%20sell%20within%20Eluru%20district" target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex">
                <Button size="lg" className="gap-2 bg-white font-bold text-emerald-950 hover:bg-emerald-50">
                  <MessageCircle className="h-4 w-4" /> Check today&apos;s paddy rate
                </Button>
              </a>
            </div>

            <div className="grid gap-px bg-white/10 sm:grid-cols-2">
              {paddyBenefits.map((benefit) => (
                <div key={benefit} className="flex min-h-28 items-start gap-3 bg-[#173b29] p-6">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <p className="text-sm font-medium leading-6 text-emerald-50/85">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-stone-200 bg-white px-4 py-16 dark:border-stone-800 dark:bg-stone-950">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Licensed & registered</p>
                <h2 className="font-mill-display mt-3 text-3xl font-black uppercase leading-none text-stone-900 dark:text-stone-100">A mill you can verify.</h2>
                <p className="mt-4 text-sm leading-6 text-stone-600 dark:text-stone-400">Government registrations and certified weighing support transparent business with suppliers and buyers.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {certifications.map((certification) => (
                  <div key={certification.label} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-900">
                    <certification.icon className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs font-bold leading-4 text-stone-700 dark:text-stone-200">{certification.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 md:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { value: "Open", label: "weighing", text: "Weight and moisture are checked transparently before acceptance." },
                { value: "Local", label: "service", text: "Focused on Eluru district for dependable pickup, delivery, and support." },
                { value: "Direct", label: "contact", text: "Speak with the mill team—not a marketplace or anonymous middleman." },
              ].map((point) => (
                <div key={point.value} className="border-t-2 border-amber-500 pt-5">
                  <p className="font-mill-display text-3xl font-black uppercase text-stone-900 dark:text-stone-100">{point.value} <span className="text-amber-600 dark:text-amber-400">{point.label}</span></p>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-stone-600 dark:text-stone-400">{point.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-8">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-7 rounded-[2rem] bg-amber-400 p-8 text-stone-950 sm:p-10 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Bulk order or paddy enquiry?</p>
              <h2 className="font-mill-display mt-2 text-3xl font-black uppercase leading-none sm:text-4xl">Talk directly to the mill.</h2>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Hanuman Junction, Eluru district</span>
                <a href="tel:+919703022892" className="flex items-center gap-2 hover:underline"><Phone className="h-4 w-4" /> +91 97030 22892</a>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/contact"><Button size="lg" variant="outline" className="w-full border-stone-950/30 bg-transparent font-bold text-stone-950 hover:bg-amber-300 sm:w-auto">Send enquiry</Button></Link>
              <a href="https://wa.me/919703022892" target="_blank" rel="noopener noreferrer"><Button size="lg" className="w-full gap-2 bg-emerald-800 font-bold text-white hover:bg-emerald-900 sm:w-auto"><MessageCircle className="h-4 w-4" /> WhatsApp</Button></a>
            </div>
          </div>
        </section>
      </main>

      <FloatingWhatsApp />

      <footer className="border-t border-stone-200 px-4 py-8 dark:border-stone-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-mill-display text-sm font-black uppercase tracking-wide">Panduranga Rice Mill</p>
              <p className="text-xs text-stone-500">Hanuman Junction, Eluru district, Andhra Pradesh</p>
            </div>
          </div>
          <p className="text-xs text-stone-500">© {new Date().getFullYear()} Panduranga Rice Mill</p>
        </div>
      </footer>
    </div>
  );
}

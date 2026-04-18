import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, Wheat, Star, Truck, Shield } from "lucide-react";

const riceTypes = [
  { name: "BPT 5204 (Sona Masoori)", desc: "Premium quality, thin grain — highest demand in AP", badge: "Premium" },
  { name: "MTU 1010 (Rajanna)", desc: "Common variety, medium grain — good for daily use", badge: "Popular" },
  { name: "Boiled Rice", desc: "Parboiled for better nutrition retention", badge: "Nutritious" },
  { name: "Broken Rice", desc: "Ideal for flour mills and animal feed", badge: "Bulk" },
  { name: "Rice Bran", desc: "By-product — sold to oil extraction units", badge: "By-product" },
  { name: "Rice Husk", desc: "Used as biomass fuel in boilers", badge: "Fuel" },
];

const features = [
  { icon: Wheat, title: "Modern Milling", desc: "State-of-the-art machinery ensures high yield and quality output" },
  { icon: Star, title: "Premium Quality", desc: "Careful grading and moisture control at every step" },
  { icon: Truck, title: "Bulk Delivery", desc: "We supply to wholesalers across Krishna and NTR districts" },
  { icon: Shield, title: "Trusted Since Decades", desc: "Family business with deep roots in Hanuman Junction" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-white border-b border-amber-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌾</span>
            <div>
              <p className="font-bold text-sm text-amber-900 leading-tight">Panduranga Rice Mill</p>
              <p className="text-xs text-amber-600">Hanuman Junction, AP</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/products" className="text-sm text-gray-600 hover:text-amber-700 hidden sm:block">Products</Link>
            <Link href="/contact" className="text-sm text-gray-600 hover:text-amber-700 hidden sm:block">Contact</Link>
            <Link href="/login">
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">Staff Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-50 to-amber-100 px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto text-center">
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 mb-4">Est. in Hanuman Junction, AP</Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-amber-900 leading-tight">
            Fresh Milled Rice<br />Straight from the Mill
          </h1>
          <p className="mt-4 text-lg text-amber-700 max-w-xl mx-auto">
            Panduranga Rice Mill — your trusted source for BPT 5204, MTU 1010, and other varieties.
            Wholesale supply across Krishna & NTR districts.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <a href="https://wa.me/91XXXXXXXXXX?text=Hi,%20I%20need%20rice%20pricing" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
                💬 WhatsApp Us
              </Button>
            </a>
            <Link href="/products">
              <Button size="lg" variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-50 w-full sm:w-auto">
                View Products & Prices
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="text-center p-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <f.icon className="w-5 h-5 text-amber-600" />
              </div>
              <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
              <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Products preview */}
      <section className="bg-amber-50 px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-amber-900 text-center mb-2">Our Products</h2>
          <p className="text-center text-amber-700 text-sm mb-8">Quality rice at wholesale prices</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {riceTypes.map((r) => (
              <Card key={r.name} className="border-amber-200 hover:border-amber-400 transition-colors">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-800 text-sm leading-snug">{r.name}</p>
                    <Badge variant="secondary" className="text-xs shrink-0">{r.badge}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">{r.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/products">
              <Button className="bg-amber-600 hover:bg-amber-700">See Current Prices</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="px-4 py-12 max-w-5xl mx-auto text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Get in Touch</h2>
        <p className="text-gray-500 text-sm mb-6">For bulk orders, pricing, or delivery inquiries</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4 text-amber-600" />
            <span>+91 XXXXX XXXXX</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 text-amber-600" />
            <span>Hanuman Junction, Krishna District, AP</span>
          </div>
        </div>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/contact">
            <Button variant="outline" className="border-amber-300 text-amber-700">Contact Form</Button>
          </Link>
          <a href="https://wa.me/91XXXXXXXXXX" target="_blank" rel="noopener noreferrer">
            <Button className="bg-green-600 hover:bg-green-700">WhatsApp</Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-amber-900 text-amber-200 px-4 py-6 text-center text-sm">
        <p className="font-semibold text-white">Panduranga Rice Mill</p>
        <p className="mt-1">Hanuman Junction, Krishna District, Andhra Pradesh</p>
        <p className="mt-2 text-amber-400 text-xs">© {new Date().getFullYear()} All rights reserved</p>
      </footer>
    </div>
  );
}

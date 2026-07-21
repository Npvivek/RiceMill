"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Phone, MapPin, CheckCircle, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FloatingWhatsApp } from "@/components/ui/whatsapp-button";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const message = String(fd.get("message") || "").trim();
    const details = [
      `Hi, I am ${name}.`,
      message,
      phone ? `Phone: ${phone}` : "",
      email ? `Email: ${email}` : "",
    ].filter(Boolean).join("\n");

    window.open(`https://wa.me/919703022892?text=${encodeURIComponent(details)}`, "_blank", "noopener,noreferrer");
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FloatingWhatsApp />

      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            </Link>
            <div className="border-l border-border pl-3">
              <p className="font-bold text-sm text-amber-800 dark:text-amber-300">Contact Us</p>
              <p className="text-xs text-muted-foreground">Panduranga Rice Mill</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-b border-border px-4 py-10 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-amber-900 dark:text-amber-100">Let&apos;s Talk</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
          For bulk orders, pricing, or to sell paddy — we respond fast on WhatsApp.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-5 gap-6">

          {/* Left — contact methods */}
          <div className="md:col-span-2 space-y-4">

            {/* WhatsApp — hero card */}
            <a
              href="https://wa.me/919703022892?text=Hi,%20I%20have%20an%20enquiry"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="relative overflow-hidden rounded-2xl bg-[#25D366] hover:bg-[#20bc5a] transition-colors p-5 cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 mt-0.5">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-lg leading-tight">WhatsApp Us</p>
                    <p className="text-white/80 text-sm mt-0.5">+91 97030 22892</p>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <Clock className="w-3.5 h-3.5 text-white/70" />
                      <span className="text-white/80 text-xs">Usually replies within the hour</span>
                    </div>
                  </div>
                  <div className="shrink-0 self-center opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                    <svg className="w-5 h-5 fill-white" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </div>
              </div>
            </a>

            {/* Call */}
            <a href="tel:+919703022892" className="block">
              <Card className="border-border bg-card hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-sm transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-11 h-11 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Call us</p>
                    <p className="font-bold text-foreground">+91 97030 22892</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Mon – Sat, 8 am – 6 pm</p>
                  </div>
                </CardContent>
              </Card>
            </a>

            {/* Location */}
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-11 h-11 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Visit us</p>
                  <p className="font-bold text-foreground">Panduranga Rice Mill</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    Hanuman Junction,<br />Eluru District, Andhra Pradesh
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right — form */}
          <div className="md:col-span-3">
            <Card className="border-border bg-card">
              <CardContent className="p-6">
                {sent ? (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="font-bold text-foreground text-lg">WhatsApp opened</p>
                    <p className="text-sm text-muted-foreground mt-1">Send the prepared message there and we&apos;ll get back to you soon.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      For faster response, WhatsApp us at{" "}
                      <a href="https://wa.me/919703022892" className="text-green-600 dark:text-green-400 font-medium hover:underline">
                        +91 97030 22892
                      </a>
                    </p>
                  </div>
                ) : (
                  <>
                    <h2 className="font-bold text-foreground text-lg mb-5">Send a Message</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>Name *</Label>
                        <Input name="name" required placeholder="Your name" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Phone</Label>
                          <Input name="phone" type="tel" inputMode="numeric" placeholder="9876543210" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Email</Label>
                          <Input name="email" type="email" placeholder="Optional" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Message *</Label>
                        <Textarea
                          name="message"
                          required
                          placeholder="e.g. I need 50 quintals of broken rice, or I want to sell paddy…"
                          rows={5}
                        />
                      </div>
                      <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">
                        Continue on WhatsApp
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Or reach us instantly on{" "}
                        <a href="https://wa.me/919703022892" className="text-green-600 dark:text-green-400 hover:underline font-medium">
                          WhatsApp
                        </a>
                      </p>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}

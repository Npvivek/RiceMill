"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Phone, MapPin, MessageCircle, CheckCircle } from "lucide-react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/api/public/contact", {
        name: fd.get("name"),
        phone: fd.get("phone") || null,
        email: fd.get("email") || null,
        message: fd.get("message"),
      });
      setSent(true);
    } catch {
      toast.error("Failed to send message. Please call or WhatsApp us directly.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <nav className="sticky top-0 z-10 bg-white border-b border-amber-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="w-4 h-4" /> Back</Button></Link>
          <div>
            <p className="font-bold text-sm text-amber-900">Contact Us</p>
            <p className="text-xs text-amber-600">Panduranga Rice Mill</p>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h1 className="text-2xl font-bold text-amber-900 mb-2">Get in Touch</h1>
            <p className="text-sm text-gray-500 mb-6">For pricing, bulk orders, or any queries about our rice</p>

            <div className="space-y-4">
              <a href="https://wa.me/91XXXXXXXXXX?text=Hi,%20I%20have%20an%20enquiry" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 gap-2 justify-start">
                  <MessageCircle className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-semibold leading-tight">WhatsApp Us</p>
                    <p className="text-xs opacity-80">Fastest response</p>
                  </div>
                </Button>
              </a>

              <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-amber-200">
                <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Call us</p>
                  <p className="font-semibold text-gray-800">+91 XXXXX XXXXX</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-amber-200">
                <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Visit us</p>
                  <p className="font-semibold text-gray-800">Hanuman Junction</p>
                  <p className="text-sm text-gray-500">Krishna District, Andhra Pradesh</p>
                </div>
              </div>
            </div>
          </div>

          <Card className="border-amber-200">
            <CardContent className="pt-5">
              {sent ? (
                <div className="py-8 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-gray-800">Message sent!</p>
                  <p className="text-sm text-gray-500 mt-1">We&apos;ll contact you soon</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h2 className="font-semibold text-gray-800">Send a message</h2>
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
                    <Textarea name="message" required placeholder="e.g. I need 50 quintals of BPT 5204 rice…" rows={4} />
                  </div>
                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={loading}>
                    {loading ? "Sending…" : "Send Message"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

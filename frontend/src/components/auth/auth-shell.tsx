import Link from "next/link";
import { ShieldCheck, Wheat } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-amber-50 px-4 py-12 dark:bg-[#100b08]">
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-200/50 to-transparent dark:from-amber-950/40" />
      <div className="absolute -left-20 bottom-16 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-900/10" />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-3" aria-label="Panduranga Rice Mill home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Wheat className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-sm font-bold text-amber-950 dark:text-amber-100">Panduranga Rice Mill</span>
            <span className="block text-xs text-amber-700/70 dark:text-amber-400/70">Private mill workspace</span>
          </span>
        </Link>

        <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-[0_24px_80px_rgba(120,53,15,0.12)] sm:p-8 dark:border-amber-900/70 dark:bg-gray-950 dark:shadow-black/30">
          {children}
        </section>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-amber-800/60 dark:text-amber-300/50">
          <ShieldCheck className="h-3.5 w-3.5" /> Protected with Supabase authentication
        </p>
      </div>
    </main>
  );
}

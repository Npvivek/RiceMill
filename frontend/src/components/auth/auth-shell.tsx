import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f3eb] px-5 py-12 dark:bg-[#100c09]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,119,6,0.09),transparent_38%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(217,119,6,0.08),transparent_42%)]" />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center" aria-label="Panduranga Rice Mill home">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-700/70 dark:text-amber-400/70">
            Panduranga
          </span>
          <span className="mt-1 block text-base font-semibold tracking-tight text-stone-950 dark:text-stone-100">
            Rice Mill
          </span>
        </Link>

        <section className="relative overflow-hidden rounded-[1.75rem] border border-stone-200/90 bg-white p-7 shadow-[0_28px_80px_rgba(73,45,21,0.10)] sm:p-9 dark:border-stone-800 dark:bg-[#17120e] dark:shadow-black/30">
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/80 to-transparent" />
          {children}
        </section>
      </div>
    </main>
  );
}

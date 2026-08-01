"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { loginAction, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function LoginForm({ next = "/dashboard", resetLinkError = false }: { next?: string; resetLinkError?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-stone-950 dark:text-stone-50">Sign in</h1>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-medium text-stone-600 dark:text-stone-300">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-12 rounded-xl border-stone-200 bg-stone-50/70 px-4 focus-visible:border-amber-600 focus-visible:ring-amber-600/15 dark:border-stone-700 dark:bg-stone-950/40"
            placeholder="name@example.com"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="passcode" className="text-xs font-medium text-stone-600 dark:text-stone-300">Passcode</Label>
            <Link href="/forgot-passcode" className="text-xs font-medium text-stone-500 transition-colors hover:text-amber-700 dark:text-stone-400 dark:hover:text-amber-400">
              Forgot passcode?
            </Link>
          </div>
          <Input
            id="passcode"
            name="passcode"
            type="password"
            autoComplete="current-password"
            required
            className="h-12 rounded-xl border-stone-200 bg-stone-50/70 px-4 focus-visible:border-amber-600 focus-visible:ring-amber-600/15 dark:border-stone-700 dark:bg-stone-950/40"
          />
        </div>

        {(state.message || resetLinkError) && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {state.message ?? "That reset link is invalid or has expired. Request a new one."}
          </p>
        )}

        <Button type="submit" disabled={pending} className="mt-2 h-12 w-full gap-2 rounded-xl bg-amber-700 font-semibold text-white shadow-none transition-colors hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500">
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {pending ? "Signing in…" : "Continue"}
        </Button>
      </form>
    </>
  );
}

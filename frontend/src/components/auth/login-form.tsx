"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { loginAction, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function LoginForm({ next = "/dashboard", resetLinkError = false }: { next?: string; resetLinkError?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <>
      <div className="mb-7">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white">Owner login</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">Open the private Excel analysis and saved mill reports.</p>
      </div>

      <form action={action} className="space-y-5">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-11 pl-10" placeholder="name@example.com" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="passcode">Passcode</Label>
            <Link href="/forgot-passcode" className="text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300">Forgot passcode?</Link>
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input id="passcode" name="passcode" type="password" autoComplete="current-password" required className="h-11 pl-10" />
          </div>
        </div>

        {(state.message || resetLinkError) && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {state.message ?? "That reset link is invalid or has expired. Request a new one."}
          </p>
        )}

        <Button type="submit" disabled={pending} className="h-11 w-full gap-2 bg-amber-600 text-white hover:bg-amber-700">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
          {pending ? "Checking…" : "Open dashboard"}
        </Button>
      </form>
    </>
  );
}

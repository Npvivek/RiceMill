"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { requestPasscodeResetAction, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function ForgotPasscodeForm() {
  const [state, action, pending] = useActionState(requestPasscodeResetAction, initialState);

  if (state.sent) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-stone-950 dark:text-stone-50">Check your email</h1>
        <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">Use the link we sent to choose a new passcode.</p>
        <Link href="/login" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-stone-950 dark:text-stone-50">Reset passcode</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">We’ll send a reset link to your email.</p>
      </div>

      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-medium text-stone-600 dark:text-stone-300">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-12 rounded-xl border-stone-200 bg-stone-50/70 px-4 focus-visible:border-amber-600 focus-visible:ring-amber-600/15 dark:border-stone-700 dark:bg-stone-950/40" placeholder="name@example.com" />
        </div>

        {state.message && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{state.message}</p>
        )}

        <Button type="submit" disabled={pending} className="h-12 w-full gap-2 rounded-xl bg-amber-700 font-semibold text-white shadow-none hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500">
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {pending ? "Sending…" : "Send reset email"}
        </Button>
      </form>

      <Link href="/login" className="mt-7 flex items-center justify-center gap-2 text-sm font-medium text-stone-500 hover:text-amber-700 dark:text-stone-400 dark:hover:text-amber-400">
        <ArrowLeft className="h-4 w-4" /> Back to login
      </Link>
    </>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle, Mail } from "lucide-react";
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
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-gray-950 dark:text-white">Check your email</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">Open the reset link from Supabase, then choose a new passcode. The link expires for your protection.</p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
          <Mail className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white">Reset your passcode</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">Enter the email connected to your mill account. We’ll send a secure reset link.</p>
      </div>

      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Account email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" placeholder="name@example.com" />
        </div>

        {state.message && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{state.message}</p>
        )}

        <Button type="submit" disabled={pending} className="h-11 w-full gap-2 bg-amber-600 text-white hover:bg-amber-700">
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {pending ? "Sending…" : "Send reset email"}
        </Button>
      </form>

      <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-gray-500 hover:text-amber-700 dark:text-gray-400 dark:hover:text-amber-400">
        <ArrowLeft className="h-4 w-4" /> Back to login
      </Link>
    </>
  );
}

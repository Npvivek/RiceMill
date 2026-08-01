"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { updatePasscodeAction, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function ResetPasscodeForm() {
  const [state, action, pending] = useActionState(updatePasscodeAction, initialState);

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-stone-950 dark:text-stone-50">New passcode</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">Use at least eight characters.</p>
      </div>

      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="passcode" className="text-xs font-medium text-stone-600 dark:text-stone-300">New passcode</Label>
          <Input id="passcode" name="passcode" type="password" autoComplete="new-password" minLength={8} required className="h-12 rounded-xl border-stone-200 bg-stone-50/70 px-4 focus-visible:border-amber-600 focus-visible:ring-amber-600/15 dark:border-stone-700 dark:bg-stone-950/40" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation" className="text-xs font-medium text-stone-600 dark:text-stone-300">Confirm new passcode</Label>
          <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required className="h-12 rounded-xl border-stone-200 bg-stone-50/70 px-4 focus-visible:border-amber-600 focus-visible:ring-amber-600/15 dark:border-stone-700 dark:bg-stone-950/40" />
        </div>

        {state.message && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{state.message}</p>
        )}

        <Button type="submit" disabled={pending} className="h-12 w-full gap-2 rounded-xl bg-amber-700 font-semibold text-white shadow-none hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500">
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {pending ? "Updating…" : "Save new passcode"}
        </Button>
      </form>
    </>
  );
}

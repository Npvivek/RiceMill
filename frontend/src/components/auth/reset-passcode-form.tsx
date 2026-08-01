"use client";

import { useActionState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { updatePasscodeAction, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function ResetPasscodeForm() {
  const [state, action, pending] = useActionState(updatePasscodeAction, initialState);

  return (
    <>
      <div className="mb-7">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white">Choose a new passcode</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">Use at least eight characters and avoid reusing a passcode from another account.</p>
      </div>

      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="passcode">New passcode</Label>
          <Input id="passcode" name="passcode" type="password" autoComplete="new-password" minLength={8} required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation">Confirm new passcode</Label>
          <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required className="h-11" />
        </div>

        {state.message && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{state.message}</p>
        )}

        <Button type="submit" disabled={pending} className="h-11 w-full gap-2 bg-amber-600 text-white hover:bg-amber-700">
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {pending ? "Updating…" : "Save new passcode"}
        </Button>
      </form>
    </>
  );
}

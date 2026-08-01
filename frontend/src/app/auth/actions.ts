"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState = {
  message?: string;
  sent?: boolean;
};

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/dashboard";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function loginAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const passcode = String(formData.get("passcode") ?? "");

  if (!/^\S+@\S+\.\S+$/.test(email) || !passcode) {
    return { message: "Enter your email and passcode." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: passcode });

  if (error) {
    return { message: "The email or passcode is incorrect." };
  }

  redirect(safeNext(formData.get("next")));
}

export async function requestPasscodeResetAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { message: "Enter the email connected to your account." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-passcode`,
  });

  if (error) {
    return { message: "A reset email could not be sent right now. Wait a minute and try again." };
  }

  return { sent: true };
}

export async function updatePasscodeAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const passcode = String(formData.get("passcode") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (passcode.length < 8) {
    return { message: "Use at least 8 characters for the new passcode." };
  }
  if (passcode !== confirmation) {
    return { message: "The two passcodes do not match." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: passcode });
  if (error) {
    return { message: "The passcode could not be changed. Request a new reset email and try again." };
  }

  redirect("/dashboard?passcode=updated");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

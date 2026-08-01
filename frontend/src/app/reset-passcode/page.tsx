import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasscodeForm } from "@/components/auth/reset-passcode-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ResetPasscodePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AuthShell>
      <ResetPasscodeForm />
    </AuthShell>
  );
}

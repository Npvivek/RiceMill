import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell>
      <LoginForm next={params.next} resetLinkError={params.error === "reset-link"} />
    </AuthShell>
  );
}

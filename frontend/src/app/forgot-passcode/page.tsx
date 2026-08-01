import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasscodeForm } from "@/components/auth/forgot-passcode-form";

export default function ForgotPasscodePage() {
  return (
    <AuthShell>
      <ForgotPasscodeForm />
    </AuthShell>
  );
}

import { prisma } from "@/lib/prisma"
import { ResetPasswordForm } from "./ResetPasswordForm"

export const dynamic = "force-dynamic"

export default async function ResetPasswordPage() {
  const state = await prisma.adminAuthState.findUnique({
    where: { id: "singleton" },
    select: { passwordResetSealed: true },
  })

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#040302] px-4 text-[#d4cbb3]">
        <p role="alert">Password reset is not configured.</p>
      </main>
    )
  }

  if (state.passwordResetSealed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#040302] px-4 text-[#d4cbb3]">
        <p role="status" className="text-center leading-7">
          Password is changed and sealed; you cannot reset it again from this route.
        </p>
      </main>
    )
  }

  return <ResetPasswordForm />
}

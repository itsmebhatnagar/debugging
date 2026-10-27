import { prisma } from "@/lib/prisma"
import { ResetPasswordForm } from "./ResetPasswordForm"

export const dynamic = "force-dynamic"

export default async function ResetPasswordPage() {
  let state: { passwordResetSealed: boolean } | null = null
  try {
    state = await prisma.adminAuthState.findUnique({
      where: { id: "singleton" },
      select: { passwordResetSealed: true },
    })
  } catch (error) {
    console.error("Unable to load admin password reset state:", error)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#040302] px-4 text-[#d4cbb3]">
        <p role="alert" className="max-w-md text-center leading-7">
          Password reset is temporarily unavailable. The admin database migration may not have been applied yet.
        </p>
      </main>
    )
  }

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

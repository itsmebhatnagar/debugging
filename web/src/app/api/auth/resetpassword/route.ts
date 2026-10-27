import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { ADMIN_EMAIL } from "@/lib/admin-access"

const ADMIN_AUTH_STATE_ID = "singleton"
const RESET_WINDOW_MS = 15 * 60 * 1000
const MAX_RESET_ATTEMPTS = 5
let resetAttempts = 0
let resetWindowExpiresAt = 0

export async function POST(req: NextRequest) {
  const now = Date.now()
  if (now >= resetWindowExpiresAt) {
    resetAttempts = 0
    resetWindowExpiresAt = now + RESET_WINDOW_MS
  }
  if (resetAttempts >= MAX_RESET_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    )
  }
  resetAttempts += 1

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const { currentPassword, newPassword, confirmPassword } = body as {
    currentPassword?: unknown
    newPassword?: unknown
    confirmPassword?: unknown
  }
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string" ||
    !currentPassword ||
    !newPassword ||
    !confirmPassword
  ) {
    return NextResponse.json({ error: "All password fields are required." }, { status: 400 })
  }
  if (newPassword.length < 12) {
    return NextResponse.json(
      { error: "The new password must be at least 12 characters long." },
      { status: 400 },
    )
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "The new passwords do not match." }, { status: 400 })
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "The new password must be different from the current password." },
      { status: 400 },
    )
  }

  try {
    const [state, admin] = await Promise.all([
      prisma.adminAuthState.findUnique({
        where: { id: ADMIN_AUTH_STATE_ID },
        select: { passwordResetSealed: true },
      }),
      prisma.user.findUnique({
        where: { email: ADMIN_EMAIL },
        select: { id: true, password: true, role: true },
      }),
    ])

    if (!state) {
      console.error("Admin password reset state is missing.")
      return NextResponse.json({ error: "Password reset is not configured." }, { status: 503 })
    }
    if (state.passwordResetSealed) {
      return NextResponse.json(
        { error: "Password is changed and sealed; it cannot be reset again." },
        { status: 410 },
      )
    }
    if (!admin?.password || admin.role !== "ADMIN") {
      console.error("The configured admin account is missing or has no password.")
      return NextResponse.json({ error: "Admin account is not configured." }, { status: 503 })
    }

    if (!(await bcrypt.compare(currentPassword, admin.password))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    const result = await prisma.$transaction(async (tx) => {
      const stateUpdate = await tx.adminAuthState.updateMany({
        where: { id: ADMIN_AUTH_STATE_ID, passwordResetSealed: false },
        data: { passwordResetSealed: true, activeSessionId: null },
      })
      if (stateUpdate.count !== 1) return "SEALED"

      const adminUpdate = await tx.user.updateMany({
        where: { id: admin.id, password: admin.password, role: "ADMIN" },
        data: { password: passwordHash },
      })
      if (adminUpdate.count !== 1) {
        throw new Error("Admin account changed during password reset.")
      }

      return "RESET"
    })

    if (result === "SEALED") {
      return NextResponse.json(
        { error: "Password is changed and sealed; it cannot be reset again." },
        { status: 410 },
      )
    }

    return NextResponse.json({
      success: true,
      message: "Password is changed and sealed; it cannot be reset again.",
    })
  } catch (error) {
    console.error("Admin password reset failed:", error)
    return NextResponse.json({ error: "Unable to reset the admin password." }, { status: 500 })
  }
}

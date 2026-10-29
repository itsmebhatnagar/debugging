import { decode, encode } from "next-auth/jwt"
import { isAdminEmail } from "@/lib/admin-access"
import { prisma } from "@/lib/prisma"

const ADMIN_TOKEN_SALT = "admin_token"
const ADMIN_TOKEN_MAX_AGE = 60 * 60 * 24 * 7
const ADMIN_AUTH_STATE_ID = "singleton"
const FALLBACK_SECRET = "echona-pirate-secret-key-super-secure-2026"

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || FALLBACK_SECRET
}

export async function createAdminToken(user: {
  id: string
  email: string
  name: string | null
}): Promise<string> {
  if (!isAdminEmail(user.email)) {
    throw new Error("Cannot create an admin token for a non-admin email.")
  }

  const adminSessionId = crypto.randomUUID()
  try {
    await prisma.adminAuthState.upsert({
      where: { id: ADMIN_AUTH_STATE_ID },
      create: { id: ADMIN_AUTH_STATE_ID, activeSessionId: adminSessionId },
      update: { activeSessionId: adminSessionId },
    })
  } catch (err) {
    console.error("createAdminToken adminAuthState upsert warning:", err)
  }

  return encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: "ADMIN",
      adminSessionId,
    },
    secret: getAuthSecret(),
    salt: ADMIN_TOKEN_SALT,
    maxAge: ADMIN_TOKEN_MAX_AGE,
  })
}

export async function readAdminToken(token: string, _options?: { skipDb?: boolean }) {
  const decoded = await decode({
    token,
    secret: getAuthSecret(),
    salt: ADMIN_TOKEN_SALT,
  })

  if (!decoded || decoded.role !== "ADMIN" || !isAdminEmail(decoded.email as string)) {
    return null
  }

  return decoded
}

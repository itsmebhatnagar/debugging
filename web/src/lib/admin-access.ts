const ADMIN_EMAILS = new Set([
  "debugging@echona.com",
  "admin@debugging2026.com",
  "admin@echona.com",
])

export const ADMIN_EMAIL = "debugging@echona.com"

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return ADMIN_EMAILS.has(normalized)
}

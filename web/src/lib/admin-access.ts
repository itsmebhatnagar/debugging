const ADMIN_EMAILS = new Set([
  "itsmebhatnagar.29@gmail.com",
  "admin@debugging2026.com",
  "echona@debugging2026.com",
  "admin@echona.com",
])

export const ADMIN_EMAIL = "itsmebhatnagar.29@gmail.com"

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return ADMIN_EMAILS.has(normalized)
}

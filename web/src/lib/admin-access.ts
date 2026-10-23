const ADMIN_EMAILS = new Set([
  "debugging@admin2026.com",
  "itsmebhatnagar.29@gmail.com",
])

export function isAdminEmail(email: string | null | undefined): boolean {
  return email !== null && email !== undefined && ADMIN_EMAILS.has(email.trim().toLowerCase())
}

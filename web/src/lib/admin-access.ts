const ADMIN_EMAILS = new Set([
  "itsmebhatnagar.29@gmail.com",
])

export function isAdminEmail(email: string | null | undefined): boolean {
  return email !== null && email !== undefined && ADMIN_EMAILS.has(email.trim().toLowerCase())
}

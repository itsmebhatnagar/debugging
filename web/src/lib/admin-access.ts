export const ADMIN_EMAIL = "admin@debugging2026.com"

export function isAdminEmail(email: string | null | undefined): boolean {
  return email !== null && email !== undefined && email.trim().toLowerCase() === ADMIN_EMAIL
}

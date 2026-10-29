import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { readAdminToken } from "@/lib/admin-token"
import { isAdminEmail } from "@/lib/admin-access"

export default async function AdminPage() {
  const session = await auth()
  let isAdmin = session?.user?.role === "ADMIN" || isAdminEmail(session?.user?.email)

  if (!isAdmin) {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get("admin_token")?.value
    if (adminToken) {
      try {
        const decoded = await readAdminToken(adminToken)
        if (decoded && (decoded.role === "ADMIN" || isAdminEmail(decoded.email as string))) {
          isAdmin = true
        }
      } catch {}
    }
  }

  if (!isAdmin) {
    redirect("/admin/login")
  }

  redirect("/admin/dashboard")
}

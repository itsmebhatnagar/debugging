import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"

export default async function AdminPage() {
  const session = await auth()
  let isAdmin = session?.user?.role === "ADMIN"

  if (!isAdmin) {
    const cookieStore = await cookies()
    const adminToken = cookieStore.get("admin_token")?.value
    if (adminToken) {
      try {
        const decoded = JSON.parse(Buffer.from(adminToken, "base64").toString())
        if (decoded?.role === "ADMIN") {
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

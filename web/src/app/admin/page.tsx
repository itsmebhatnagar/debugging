import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function AdminPage() {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    redirect("/admin/login")
  }

  redirect("/admin/dashboard")
}

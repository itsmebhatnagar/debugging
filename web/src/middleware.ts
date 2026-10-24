import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl } = req
  let isLoggedIn = !!req.auth
  let userRole = req.auth?.user?.role

  let adminToken = req.cookies.get("admin_token")?.value
  if (!adminToken) {
    const authHeader = req.headers.get("authorization")
    if (authHeader && authHeader.startsWith("Bearer ")) {
      adminToken = authHeader.substring(7).trim()
    }
  }

  if (!isLoggedIn && adminToken) {
    try {
      const decoded = JSON.parse(Buffer.from(adminToken, "base64").toString())
      if (decoded && decoded.role === "ADMIN") {
        isLoggedIn = true
        userRole = "ADMIN"
      }
    } catch {
      // ignore invalid tokens
    }
  }

  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth")
  const isPublicRoute = ["/", "/login", "/register", "/admin/login"].includes(nextUrl.pathname)
  const isAdminRoute = nextUrl.pathname.startsWith("/admin") && nextUrl.pathname !== "/admin/login"
  const isUserRoute = nextUrl.pathname.startsWith("/dashboard")

  if (isApiAuthRoute) {
    return NextResponse.next()
  }

  // Handle API routes with proper JSON responses
  if (nextUrl.pathname.startsWith("/api/")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (nextUrl.pathname.startsWith("/api/admin/") && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }
    return NextResponse.next()
  }

  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  if (isAdminRoute && userRole !== "ADMIN") {
    // If a non-admin tries to access admin routes, redirect to dashboard or home
    return NextResponse.redirect(new URL(isLoggedIn ? "/dashboard" : "/login", nextUrl))
  }

  // Prevent logged-in users from accessing login/register pages
  if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/register" || nextUrl.pathname === "/admin/login")) {
    const redirectUrl = userRole === "ADMIN" ? "/admin" : "/dashboard"
    return NextResponse.redirect(new URL(redirectUrl, nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}

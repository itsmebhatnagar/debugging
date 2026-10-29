import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin-access"
import { readAdminToken } from "@/lib/admin-token"

export default auth(async (req) => {
  const { nextUrl } = req
  let isLoggedIn = !!req.auth
  let userRole = req.auth?.user?.role

  if (req.auth?.user?.email && isAdminEmail(req.auth.user.email)) {
    isLoggedIn = true
    userRole = "ADMIN"
  }

  let adminToken = req.cookies.get("admin_token")?.value
  if (!adminToken) {
    const authHeader = req.headers.get("authorization")
    if (authHeader && authHeader.startsWith("Bearer ")) {
      adminToken = authHeader.substring(7).trim()
    }
  }

  if (adminToken) {
    try {
      const decoded = await readAdminToken(adminToken, { skipDb: true })
      if (decoded && (decoded.role === "ADMIN" || isAdminEmail(decoded.email as string))) {
        isLoggedIn = true
        userRole = "ADMIN"
      }
    } catch {
      // ignore invalid tokens
    }
  }

  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth")
  const isPublicRoute = ["/", "/login", "/register", "/admin/login", "/resetpassword"].includes(nextUrl.pathname)
  const isAdminRoute = nextUrl.pathname.startsWith("/admin") && nextUrl.pathname !== "/admin/login"

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
    const redirectUrl = userRole === "ADMIN" ? "/admin/dashboard" : "/dashboard"
    return NextResponse.redirect(new URL(redirectUrl, nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}

import { auth } from "@/auth";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  role: "ADMIN";
}

export interface AdminSession {
  user: AdminUser;
}

/**
 * Checks whether the current request is from an authenticated admin.
 * Inspects:
 * 1. NextAuth session
 * 2. Authorization header (Bearer <admin_token>)
 * 3. Incoming Request cookies (admin_token)
 * 4. Next.js server cookie store (admin_token)
 */
export async function getAdminSession(req?: NextRequest | Request): Promise<AdminSession | null> {
  // 1. Try NextAuth session
  try {
    const session = await auth();
    if (session?.user?.role === "ADMIN") {
      return {
        user: {
          id: session.user.id || "admin",
          email: session.user.email || "admin@echona.com",
          name: session.user.name || "Admin",
          role: "ADMIN",
        },
      };
    }
  } catch {
    // NextAuth session lookup might throw or be null outside its standard handler context
  }

  // 2. Extract admin token from request (header or cookies)
  let adminToken: string | undefined;

  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      adminToken = authHeader.substring(7).trim();
    }

    if (!adminToken && "cookies" in req) {
      adminToken = (req as NextRequest).cookies.get("admin_token")?.value;
    }
  }

  // 3. Fallback to Next.js cookies()
  if (!adminToken) {
    try {
      const cookieStore = await cookies();
      adminToken = cookieStore.get("admin_token")?.value;
    } catch {
      // cookies() may throw outside Next server render / action context
    }
  }

  // 4. Validate token payload
  if (adminToken) {
    try {
      const decoded = JSON.parse(Buffer.from(adminToken, "base64").toString());
      if (decoded && decoded.role === "ADMIN") {
        return {
          user: {
            id: decoded.id || "admin",
            email: decoded.email || "admin@echona.com",
            name: decoded.name || "Admin",
            role: "ADMIN",
          },
        };
      }
    } catch {
      // Invalid token format
    }
  }

  return null;
}

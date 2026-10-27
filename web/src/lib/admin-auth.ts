import { auth } from "@/auth";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/admin-access";
import { decode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

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
 * 2. NextAuth JWT cookie in Request
 * 3. Authorization header (Bearer <admin_token>)
 * 4. Incoming Request cookies (admin_token)
 * 5. Next.js server cookie store (admin_token)
 */
export async function getAdminSession(req?: NextRequest | Request): Promise<AdminSession | null> {
  // 1. Try NextAuth session
  try {
    const session = await auth();
    if (session?.user && (session.user.role === "ADMIN" || isAdminEmail(session.user.email))) {
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

  // 2. Extract tokens from request headers/cookies
  let adminToken: string | undefined;
  let sessionToken: string | undefined;

  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      adminToken = authHeader.substring(7).trim();
    }

    if ("cookies" in req) {
      const nextReq = req as NextRequest;
      if (!adminToken) adminToken = nextReq.cookies.get("admin_token")?.value;
      sessionToken = nextReq.cookies.get("authjs.session-token")?.value ||
                     nextReq.cookies.get("__Secure-authjs.session-token")?.value;
    }
  }

  // 3. Fallback to Next.js cookies()
  if (!adminToken || !sessionToken) {
    try {
      const cookieStore = await cookies();
      if (!adminToken) adminToken = cookieStore.get("admin_token")?.value;
      if (!sessionToken) {
        sessionToken = cookieStore.get("authjs.session-token")?.value ||
                       cookieStore.get("__Secure-authjs.session-token")?.value;
      }
    } catch {
      // cookies() may throw outside Next server render / action context
    }
  }

  // 4. Validate admin_token payload
  if (adminToken) {
    try {
      const decoded = JSON.parse(Buffer.from(adminToken, "base64").toString());
      if (decoded && (decoded.role === "ADMIN" || isAdminEmail(decoded.email))) {
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

  // 5. Try decoding NextAuth session token
  if (sessionToken) {
    try {
      const secret = process.env.NEXTAUTH_SECRET || "echona-pirate-secret-key-super-secure-2026";
      const salt = sessionToken.includes("__Secure-") ? "__Secure-authjs.session-token" : "authjs.session-token";
      const token = await decode({ token: sessionToken, secret, salt });
      if (token && (token.role === "ADMIN" || isAdminEmail(token.email as string))) {
        return {
          user: {
            id: (token.id as string) || "admin",
            email: (token.email as string) || "admin@echona.com",
            name: (token.name as string) || "Admin",
            role: "ADMIN",
          },
        };
      }

      // If token has email, verify from database directly
      if (token?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, email: true, name: true, role: true }
        });
        if (dbUser && (dbUser.role === "ADMIN" || isAdminEmail(dbUser.email))) {
          return {
            user: {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name || "Admin",
              role: "ADMIN",
            },
          };
        }
      }
    } catch {
      // Decode failed
    }
  }

  return null;
}

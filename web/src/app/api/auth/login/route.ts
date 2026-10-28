import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isAdminEmail } from "@/lib/admin-access";
import { createAdminToken } from "@/lib/admin-token";
import { encode } from "next-auth/jwt";

const ADMIN_AUTH_STATE_ID = "singleton";

export async function POST(req: NextRequest) {
  try {
    let body: { email?: string; username?: string; password?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const identifier = (body.username || body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Crew ID / Email and password are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: identifier },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const isAdmin = user.role === "ADMIN" || isAdminEmail(user.email);
    let adminToken: string | undefined;
    let adminSessionId: string | undefined;

    if (isAdmin) {
      adminSessionId = crypto.randomUUID();
      try {
        await prisma.adminAuthState.upsert({
          where: { id: ADMIN_AUTH_STATE_ID },
          create: { id: ADMIN_AUTH_STATE_ID, activeSessionId: adminSessionId },
          update: { activeSessionId: adminSessionId },
        });
      } catch (e) {
        console.error("adminAuthState upsert error:", e);
      }

      try {
        adminToken = await createAdminToken(user);
      } catch (err) {
        console.error("createAdminToken error:", err);
      }
    }

    const redirectTo = isAdmin ? "/admin/dashboard" : "/dashboard";

    const response = NextResponse.json({
      success: true,
      role: isAdmin ? "ADMIN" : "USER",
      redirectTo,
      token: adminToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: isAdmin ? "ADMIN" : "USER",
      },
    });

    // 1. Set admin_token cookie if admin
    if (adminToken) {
      response.cookies.set("admin_token", adminToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    // 2. Set NextAuth session cookie for both user and admin
    try {
      const secret =
        process.env.AUTH_SECRET ||
        process.env.NEXTAUTH_SECRET ||
        "echona-pirate-secret-key-super-secure-2026";
      const isProduction = process.env.NODE_ENV === "production";
      const cookieName = isProduction
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";

      const jwtPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
        mobile: user.mobile,
        role: isAdmin ? "ADMIN" : "USER",
        adminSessionId: isAdmin ? adminSessionId : undefined,
        sub: user.id,
      };

      const sessionToken = await encode({
        token: jwtPayload,
        secret,
        salt: cookieName,
        maxAge: 30 * 24 * 60 * 60,
      });

      response.cookies.set(cookieName, sessionToken, {
        httpOnly: true,
        secure: isProduction,
        path: "/",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
      });

      // In production or development, ensure fallback cookie name is also set if secure prefix varies
      if (isProduction) {
        response.cookies.set("authjs.session-token", sessionToken, {
          httpOnly: true,
          secure: true,
          path: "/",
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60,
        });
      }
    } catch (e) {
      console.error("Failed to generate NextAuth session token:", e);
    }

    return response;
  } catch (error: unknown) {
    console.error("POST /api/auth/login error:", error);
    const message = error instanceof Error ? error.message : "Authentication error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

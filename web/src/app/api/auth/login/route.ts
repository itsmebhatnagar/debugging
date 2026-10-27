import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isAdminEmail } from "@/lib/admin-access";
import { createAdminToken } from "@/lib/admin-token";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = (body.username || body.email || "").trim().toLowerCase();
    const password = body.password;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Username/Email and password are required" },
        { status: 400 }
      );
    }

    if (!isAdminEmail(identifier)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: identifier },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.role !== "ADMIN" || !isAdminEmail(user.email)) {
      return NextResponse.json(
        { error: "Access denied: Captain's Quarters (Admin) access only!" },
        { status: 403 }
      );
    }

    const token = await createAdminToken(user);

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set("admin_token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Authentication error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

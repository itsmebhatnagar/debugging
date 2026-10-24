import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const question = await prisma.question.findUnique({
      where: { id },
      include: { testCases: true, starterCodes: true }
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json(question);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.question.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/quizzes/questions/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(req);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const updated = await prisma.question.update({
      where: { id },
      data: {
        title: body.title || body.text,
        description: body.description,
        points: body.points || body.marks,
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

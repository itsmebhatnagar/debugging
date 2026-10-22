import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { roundId } = await params;
    const questions = await prisma.question.findMany({
      where: { roundId },
      include: {
        testCases: true,
        starterCodes: true,
      },
      orderBy: { createdAt: "asc" }
    });

    // Format questions so they work whether consumer expects coding schema or quiz options schema
    const formatted = questions.map((q) => {
      // If question has test cases, format them nicely
      const options = q.testCases.map((tc, idx) => ({
        id: tc.id,
        text: `Input: ${tc.input || "(none)"} -> Expected: ${tc.expected}`,
        isCorrect: !tc.isHidden,
        isHidden: tc.isHidden
      }));

      return {
        id: q.id,
        roundId: q.roundId,
        title: q.title,
        text: q.title,
        description: q.description,
        points: q.points,
        marks: q.points,
        negativeMarks: 0,
        options: options.length > 0 ? options : [
          { id: "opt_1", text: "Standard Output Match", isCorrect: true },
          { id: "opt_2", text: "Runtime Limit", isCorrect: false }
        ],
        testCases: q.testCases,
        starterCodes: q.starterCodes,
        createdAt: q.createdAt
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET /api/quizzes/rounds/[roundId]/questions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { roundId } = await params;
    const body = await req.json();
    const title = body.title || body.text || "Untitled Challenge";
    const description = body.description || body.text || "Solve the challenge according to requirements.";
    const points = typeof body.points === "number" ? body.points : (typeof body.marks === "number" ? body.marks : 100);

    const question = await prisma.question.create({
      data: {
        roundId,
        title,
        description,
        points: Math.round(points),
      }
    });

    // If options / test cases supplied
    if (Array.isArray(body.testCases) && body.testCases.length > 0) {
      for (const tc of body.testCases) {
        await prisma.testCase.create({
          data: {
            questionId: question.id,
            input: tc.input || "",
            expected: tc.expected || "",
            isHidden: Boolean(tc.isHidden)
          }
        });
      }
    } else if (Array.isArray(body.options) && body.options.length > 0) {
      for (const opt of body.options) {
        if (opt.text && opt.text.trim()) {
          await prisma.testCase.create({
            data: {
              questionId: question.id,
              input: opt.text,
              expected: opt.isCorrect ? "CORRECT" : "INCORRECT",
              isHidden: false
            }
          });
        }
      }
    }

    // Default starter code
    await prisma.starterCode.create({
      data: {
        questionId: question.id,
        language: "c",
        code: `#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}\n`
      }
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/quizzes/rounds/[roundId]/questions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { runAIDebugger } from "@/lib/ai-debugger"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: unknown = await req.json()
    if (
      typeof body !== "object"
      || body === null
      || !("submissionId" in body)
      || typeof body.submissionId !== "string"
      || !body.submissionId
    ) {
      return NextResponse.json({ error: "Missing submissionId" }, { status: 400 })
    }
    const submissionId = body.submissionId
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        question: {
          select: { title: true, description: true }
        },
        aiAnalysis: true,
      }
    })

    if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    if (submission.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const aiEval = await runAIDebugger(
      submission.code,
      submission.language,
      submission.question.title,
      submission.question.description || "",
      submission.status === "ACCEPTED"
    )

    await prisma.aIAnalysis.upsert({
      where: { submissionId },
      create: {
        submissionId,
        correctness: aiEval.correctness,
        codeQuality: aiEval.codeQuality,
        bugs: aiEval.bugs,
        feedback: aiEval.feedback,
        status: aiEval.status,
      },
      update: {
        correctness: aiEval.correctness,
        codeQuality: aiEval.codeQuality,
        bugs: aiEval.bugs,
        feedback: aiEval.feedback,
        status: aiEval.status,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Background AI Error]", err)
    const message = err instanceof Error ? err.message : "Analysis failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

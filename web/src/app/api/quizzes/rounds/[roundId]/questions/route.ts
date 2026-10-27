import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const session = await getAdminSession(req);
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
    const session = await getAdminSession(req);
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

    // Starter codes: C, C++, Java
    const defaultC = `#include <stdio.h>\n#include <string.h>\n\nint main() {\n    char input[4096];\n    if (fgets(input, sizeof(input), stdin)) {\n        input[strcspn(input, "\\r\\n")] = 0;\n        // Write your solution here\n        printf("%s\\n", input);\n    }\n    return 0;\n}\n`;
    const defaultCpp = `#include <iostream>\n#include <string>\n\nusing namespace std;\n\nint main() {\n    string line;\n    if (getline(cin, line)) {\n        // Write your solution here\n        cout << line << "\\n";\n    }\n    return 0;\n}\n`;
    const defaultJava = `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));\n        String line = reader.readLine();\n        if (line != null) {\n            // Write your solution here\n            System.out.println(line);\n        }\n    }\n}\n`;

    const cStarter = typeof body.cStarter === "string" && body.cStarter.trim() ? body.cStarter : defaultC;
    const cppStarter = typeof body.cppStarter === "string" && body.cppStarter.trim() ? body.cppStarter : defaultCpp;
    const javaStarter = typeof body.javaStarter === "string" && body.javaStarter.trim() ? body.javaStarter : defaultJava;

    await prisma.starterCode.createMany({
      data: [
        { questionId: question.id, language: "c", code: cStarter },
        { questionId: question.id, language: "cpp", code: cppStarter },
        { questionId: question.id, language: "java", code: javaStarter },
      ],
      skipDuplicates: true
    });

    // Test cases: support testCases array or testInput1/2/3 vectors
    if (Array.isArray(body.testCases) && body.testCases.length > 0) {
      for (const tc of body.testCases) {
        if (tc.expected || tc.input) {
          await prisma.testCase.create({
            data: {
              questionId: question.id,
              input: tc.input || "",
              expected: tc.expected || "",
              isHidden: Boolean(tc.isHidden)
            }
          });
        }
      }
    } else {
      if (body.testExpected1 !== undefined && String(body.testExpected1).trim()) {
        await prisma.testCase.create({
          data: {
            questionId: question.id,
            input: body.testInput1 || "",
            expected: String(body.testExpected1).trim(),
            isHidden: false
          }
        });
      }
      if (body.testExpected2 !== undefined && String(body.testExpected2).trim()) {
        await prisma.testCase.create({
          data: {
            questionId: question.id,
            input: body.testInput2 || "",
            expected: String(body.testExpected2).trim(),
            isHidden: true
          }
        });
      }
      if (body.testExpected3 !== undefined && String(body.testExpected3).trim()) {
        await prisma.testCase.create({
          data: {
            questionId: question.id,
            input: body.testInput3 || "",
            expected: String(body.testExpected3).trim(),
            isHidden: true
          }
        });
      }
    }

    return NextResponse.json(question, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/quizzes/rounds/[roundId]/questions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

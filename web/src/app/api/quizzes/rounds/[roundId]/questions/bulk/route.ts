import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

const DEFAULT_C = `#include <stdio.h>
#include <string.h>

int main() {
    char input[4096];
    if (fgets(input, sizeof(input), stdin)) {
        input[strcspn(input, "\\r\\n")] = 0;
        // Write your solution here
        printf("%s\\n", input);
    }
    return 0;
}
`;

const DEFAULT_CPP = `#include <iostream>
#include <string>

using namespace std;

int main() {
    string line;
    if (getline(cin, line)) {
        // Write your solution here
        cout << line << "\\n";
    }
    return 0;
}
`;

const DEFAULT_JAVA = `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line = reader.readLine();
        if (line != null) {
            // Write your solution here
            System.out.println(line);
        }
    }
}
`;

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
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { competition: true }
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const body = await req.json();
    const rawQuestions = Array.isArray(body) ? body : (Array.isArray(body?.questions) ? body.questions : []);

    if (!rawQuestions || rawQuestions.length === 0) {
      return NextResponse.json({ error: "No questions provided in manifest." }, { status: 400 });
    }

    const createdQuestions = [];

    for (const q of rawQuestions) {
      const title = (q.title || q.Title || q.name || q.Name || q.question || q.Question || q.text || "Untitled Challenge").trim();
      const description = (q.description || q.Description || q.desc || q.Desc || q.problem || q.text || "Solve the challenge according to the specifications.").trim();
      const rawPoints = q.points ?? q.Points ?? q.marks ?? q.Marks ?? 100;
      const points = typeof rawPoints === "number" ? Math.round(rawPoints) : parseInt(String(rawPoints), 10) || 100;

      const question = await prisma.question.create({
        data: {
          roundId,
          title,
          description,
          points,
        }
      });

      // ── Starter Codes ───────────────────────────────────────────
      const cCode = typeof q.cStarter === "string" && q.cStarter.trim() ? q.cStarter : DEFAULT_C;
      const cppCode = typeof q.cppStarter === "string" && q.cppStarter.trim() ? q.cppStarter : DEFAULT_CPP;
      const javaCode = typeof q.javaStarter === "string" && q.javaStarter.trim() ? q.javaStarter : DEFAULT_JAVA;

      await prisma.starterCode.createMany({
        data: [
          { questionId: question.id, language: "c", code: cCode },
          { questionId: question.id, language: "cpp", code: cppCode },
          { questionId: question.id, language: "java", code: javaCode },
        ],
        skipDuplicates: true
      });

      // ── Test Cases ──────────────────────────────────────────────
      if (Array.isArray(q.testCases) && q.testCases.length > 0) {
        for (const tc of q.testCases) {
          if (tc.expected !== undefined || tc.input !== undefined) {
            await prisma.testCase.create({
              data: {
                questionId: question.id,
                input: String(tc.input ?? ""),
                expected: String(tc.expected ?? "").trim(),
                isHidden: Boolean(tc.isHidden)
              }
            });
          }
        }
      } else {
        // Public Test Case 1
        const exp1 = q.testExpected1 ?? q.TestExpected1 ?? q.expected1 ?? q.Expected1 ?? q.output1 ?? q.Output1;
        if (exp1 !== undefined && String(exp1).trim()) {
          const inp1 = q.testInput1 ?? q.TestInput1 ?? q.input1 ?? q.Input1 ?? "";
          await prisma.testCase.create({
            data: {
              questionId: question.id,
              input: String(inp1),
              expected: String(exp1).trim(),
              isHidden: false
            }
          });
        }

        // Hidden Test Case 2
        const exp2 = q.testExpected2 ?? q.TestExpected2 ?? q.expected2 ?? q.Expected2 ?? q.output2 ?? q.Output2;
        if (exp2 !== undefined && String(exp2).trim()) {
          const inp2 = q.testInput2 ?? q.TestInput2 ?? q.input2 ?? q.Input2 ?? "";
          await prisma.testCase.create({
            data: {
              questionId: question.id,
              input: String(inp2),
              expected: String(exp2).trim(),
              isHidden: true
            }
          });
        }

        // Hidden Test Case 3
        const exp3 = q.testExpected3 ?? q.TestExpected3 ?? q.expected3 ?? q.Expected3 ?? q.output3 ?? q.Output3;
        if (exp3 !== undefined && String(exp3).trim()) {
          const inp3 = q.testInput3 ?? q.TestInput3 ?? q.input3 ?? q.Input3 ?? "";
          await prisma.testCase.create({
            data: {
              questionId: question.id,
              input: String(inp3),
              expected: String(exp3).trim(),
              isHidden: true
            }
          });
        }
      }

      createdQuestions.push(question);
    }

    return NextResponse.json({
      success: true,
      count: createdQuestions.length,
      questions: createdQuestions
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/quizzes/rounds/[roundId]/questions/bulk error:", error);
    return NextResponse.json({ error: error.message || "Bulk questions import failed." }, { status: 500 });
  }
}


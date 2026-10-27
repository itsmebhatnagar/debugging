import type { ExecutionResult, ExecutionService, ExecutionVerdict } from "./types"

export type JudgingMode = "line" | "token" | "exact"

export interface JudgingTestCase {
  input: string
  expected: string
  isHidden: boolean
  mode?: JudgingMode
}

export async function judgeTestCases(
  executionService: ExecutionService,
  language: string,
  code: string,
  testCases: JudgingTestCase[],
): Promise<{ results: ExecutionResult[]; verdict: ExecutionVerdict; passedCount: number }> {
  if (testCases.length === 0) {
    throw new Error("Cannot judge a submission without test cases.")
  }

  const results: ExecutionResult[] = []

  for (let index = 0; index < testCases.length; index++) {
    const testCase = testCases[index]
    const result = await executionService.execute({
      language,
      code,
      input: testCase.input,
      expectedOutput: testCase.expected,
      judgingMode: testCase.mode,
    })
    results.push(result)

    if (
      result.verdict === "Compilation Error"
      || result.verdict === "Internal Error"
      || result.verdict === "Time Limit Exceeded"
      || result.verdict === "Memory Limit Exceeded"
      || result.verdict === "Output Limit Exceeded"
    ) {
      break
    }
  }

  return {
    results,
    verdict: getOverallVerdict(results),
    passedCount: results.filter((result) => result.passed).length,
  }
}

export function getPublicTestResults<T extends JudgingTestCase>(
  testCases: T[],
  results: ExecutionResult[],
): Array<{ result: ExecutionResult; testCase: T }> {
  return results
    .map((result, index) => ({ result, testCase: testCases[index] }))
    .filter(({ testCase }) => testCase && !testCase.isHidden)
}

export function normalizeLineOutput(output: string): string {
  const lines = output
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/gu, " "))

  // Strip trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop()
  }

  return lines.join("\n")
}

export function normalizeTokenOutput(output: string): string {
  return output.trim().replace(/\s+/gu, " ")
}

export function normalizeOutput(output: string): string {
  return normalizeLineOutput(output)
}

export function matchesExpectedOutput(
  actual: string | null,
  expected: string,
  mode: JudgingMode = "line"
): boolean {
  if (actual == null && expected === "") return true
  if (actual == null) return false

  if (mode === "exact") {
    return actual === expected
  }

  if (mode === "token") {
    const actualTokens = actual.trim().split(/\s+/u).filter(Boolean)
    const expectedTokens = expected.trim().split(/\s+/u).filter(Boolean)
    if (actualTokens.length !== expectedTokens.length) return false
    return actualTokens.every((token, index) => token === expectedTokens[index])
  }

  // mode === "line" (default for ordinary output comparison):
  // Line boundaries are preserved. Whitespace runs on the same line and trailing newlines are normalized.
  return normalizeLineOutput(actual) === normalizeLineOutput(expected)
}

export function getOverallVerdict(results: ExecutionResult[]): ExecutionVerdict {
  if (results.length === 0) {
    throw new Error("Cannot determine a verdict without execution results.")
  }

  const failures: ExecutionVerdict[] = [
    "Internal Error",
    "Compilation Error",
    "Memory Limit Exceeded",
    "Runtime Error",
    "Time Limit Exceeded",
    "Output Limit Exceeded",
    "Wrong Answer",
  ]
  return failures.find((verdict) => results.some((result) => result.verdict === verdict)) ?? "Accepted"
}

export function toSubmissionStatus(verdict: ExecutionVerdict): string {
  return verdict.toUpperCase().replaceAll(" ", "_")
}

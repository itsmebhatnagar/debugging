import type { ExecutionRequest, ExecutionResult, ExecutionService, ExecutionVerdict } from "./types"

export interface JudgingTestCase {
  input: string
  expected: string
  isHidden: boolean
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

  const requests: ExecutionRequest[] = testCases.map((testCase) => ({
    language,
    code,
    input: testCase.input,
    expectedOutput: testCase.expected,
  }))
  const results = await Promise.all(requests.map((request) => executionService.execute(request)))
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
  if (testCases.length !== results.length) {
    throw new Error("Cannot match test-case results to the submitted test cases.")
  }

  return results
    .map((result, index) => ({ result, testCase: testCases[index] }))
    .filter(({ testCase }) => !testCase.isHidden)
}

export function normalizeOutput(output: string): string {
  return output.replace(/\s+/gu, " ").trim()
}

export function matchesExpectedOutput(actual: string | null, expected: string): boolean {
  return normalizeOutput(actual ?? "") === normalizeOutput(expected)
}

export function getOverallVerdict(results: ExecutionResult[]): ExecutionVerdict {
  if (results.length === 0) {
    throw new Error("Cannot determine a verdict without execution results.")
  }

  const failures: ExecutionVerdict[] = [
    "Internal Error",
    "Compilation Error",
    "Runtime Error",
    "Time Limit Exceeded",
    "Wrong Answer",
  ]
  return failures.find((verdict) => results.some((result) => result.verdict === verdict)) ?? "Accepted"
}

export function toSubmissionStatus(verdict: ExecutionVerdict): string {
  return verdict.toUpperCase().replaceAll(" ", "_")
}

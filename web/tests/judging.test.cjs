/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict")
const { test } = require("node:test")
const fs = require("node:fs")
const ts = require("typescript")

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  })
  module._compile(outputText, filename)
}

const {
  getOverallVerdict,
  getPublicTestResults,
  judgeTestCases,
  matchesExpectedOutput,
  normalizeOutput,
  normalizeTokenOutput,
  toSubmissionStatus,
} =
  require("../src/lib/execution/judging.ts")

test("compares output while treating whitespace runs and line endings as equivalent without silently collapsing line breaks", () => {
  // Line preservation: line breaks are preserved
  assert.equal(normalizeOutput("  alpha \r\n\t beta  "), "alpha\nbeta")
  assert.equal(normalizeTokenOutput("  alpha \r\n\t beta  "), "alpha beta")

  // Intra-line whitespace and line endings normalization
  assert.equal(matchesExpectedOutput("  1\t2\n", "1 2"), true)
  assert.equal(matchesExpectedOutput("12", "1 2"), false)

  // Meaningful differences: multi-line vs single-line is NOT silently accepted in line mode
  assert.equal(matchesExpectedOutput("1 2", "1\n2"), false)
  assert.equal(matchesExpectedOutput("1 2", "1\n2", "token"), true)

  // Trailing newlines / CRLF tolerance
  assert.equal(matchesExpectedOutput("hello\r\n\r\n", "hello\n"), true)

  // Empty outputs
  assert.equal(matchesExpectedOutput("", ""), true)
  assert.equal(matchesExpectedOutput("\n\n", ""), true)
  assert.equal(matchesExpectedOutput(null, ""), true)
  assert.equal(matchesExpectedOutput(null, "output"), false)
})

test("returns Accepted only when all test-case results are accepted", () => {
  assert.equal(getOverallVerdict([{ verdict: "Accepted" }, { verdict: "Accepted" }]), "Accepted")
  assert.equal(getOverallVerdict([{ verdict: "Accepted" }, { verdict: "Wrong Answer" }]), "Wrong Answer")
})

test("preserves terminal Judge0 verdict categories when aggregating multiple test cases", () => {
  assert.equal(getOverallVerdict([{ verdict: "Compilation Error" }]), "Compilation Error")
  assert.equal(getOverallVerdict([{ verdict: "Runtime Error" }]), "Runtime Error")
  assert.equal(getOverallVerdict([{ verdict: "Time Limit Exceeded" }]), "Time Limit Exceeded")
  assert.equal(getOverallVerdict([{ verdict: "Internal Error" }]), "Internal Error")
  assert.equal(
    getOverallVerdict([{ verdict: "Wrong Answer" }, { verdict: "Time Limit Exceeded" }]),
    "Time Limit Exceeded",
  )
})

test("maps user-facing verdicts to database-compatible submission statuses", () => {
  assert.equal(toSubmissionStatus("Accepted"), "ACCEPTED")
  assert.equal(toSubmissionStatus("Wrong Answer"), "WRONG_ANSWER")
  assert.equal(toSubmissionStatus("Compilation Error"), "COMPILATION_ERROR")
  assert.equal(toSubmissionStatus("Runtime Error"), "RUNTIME_ERROR")
  assert.equal(toSubmissionStatus("Time Limit Exceeded"), "TIME_LIMIT_EXCEEDED")
  assert.equal(toSubmissionStatus("Internal Error"), "INTERNAL_ERROR")
})

test("rejects an empty execution result list instead of inventing Accepted", () => {
  assert.throws(() => getOverallVerdict([]), /without execution results/)
})

test("executes public and hidden cases but only returns public-case detail for a participant response", async () => {
  const testCases = [
    { input: "public input", expected: "public expected", isHidden: false },
    { input: "secret hidden input", expected: "secret hidden expected", isHidden: true },
    { input: "another public input", expected: "another expected", isHidden: false },
  ]
  const executedInputs = []
  const executionService = {
    async execute(request) {
      executedInputs.push(request.input)
      return {
        stdout: request.input === "public input" ? "public expected" : "different",
        stderr: null,
        compileOutput: null,
        time: 0.1,
        memory: 1024,
        statusId: 3,
        statusDescription: "Accepted",
        verdict: request.input === "public input" ? "Accepted" : "Wrong Answer",
        passed: request.input === "public input",
      }
    },
  }

  const judging = await judgeTestCases(executionService, "c", "source", testCases)
  const publicResults = getPublicTestResults(testCases, judging.results)

  assert.deepEqual(executedInputs, testCases.map(({ input }) => input))
  assert.equal(judging.verdict, "Wrong Answer")
  assert.equal(judging.passedCount, 1)
  assert.equal(publicResults.length, 2)
  assert.ok(publicResults.every(({ testCase }) => !testCase.isHidden))
  assert.equal(JSON.stringify(publicResults).includes("secret hidden"), false)
})

test("short-circuits on terminal Compilation Error without executing subsequent test cases", async () => {
  const testCases = [
    { input: "1", expected: "1", isHidden: false },
    { input: "2", expected: "2", isHidden: true },
    { input: "3", expected: "3", isHidden: true },
  ]
  let executionCount = 0
  const executionService = {
    async execute() {
      executionCount++
      return {
        stdout: null,
        stderr: "syntax error",
        compileOutput: "syntax error on line 1",
        time: null,
        memory: null,
        statusId: 6,
        statusDescription: "Compilation Error",
        verdict: "Compilation Error",
        passed: false,
      }
    },
  }

  const judging = await judgeTestCases(executionService, "c", "invalid_syntax", testCases)
  assert.equal(executionCount, 1) // Only test case 1 ran
  assert.equal(judging.verdict, "Compilation Error")
  assert.equal(judging.passedCount, 0)
  assert.equal(judging.results.length, 1)

  const publicResults = getPublicTestResults(testCases, judging.results)
  assert.equal(publicResults.length, 1)
  assert.equal(publicResults[0].result.verdict, "Compilation Error")
})

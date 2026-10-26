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

const { bestScoreByQuestion, pointsForVerdict, totalBestQuestionScore } =
  require("../src/lib/score-calculation.ts")

test("awards configured points only for Accepted verdicts", () => {
  assert.equal(pointsForVerdict("Accepted", 25), 25)
  for (const verdict of [
    "Wrong Answer",
    "Compilation Error",
    "Runtime Error",
    "Time Limit Exceeded",
    "Memory Limit Exceeded",
    "Output Limit Exceeded",
    "Internal Error",
  ]) {
    assert.equal(pointsForVerdict(verdict, 25), 0)
  }
})

test("counts only the best verified score for each question", () => {
  const scores = [
    { questionId: "first", pointsEarned: 10 },
    { questionId: "first", pointsEarned: 10 },
    { questionId: "second", pointsEarned: 0 },
    { questionId: "second", pointsEarned: 15 },
  ]

  assert.deepEqual([...bestScoreByQuestion(scores)], [["first", 10], ["second", 15]])
  assert.equal(totalBestQuestionScore(scores), 25)
})

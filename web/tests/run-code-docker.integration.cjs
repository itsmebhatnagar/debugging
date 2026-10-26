/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict")
const { test } = require("node:test")
const fs = require("node:fs")
const Module = require("node:module")
const path = require("node:path")
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

const { DockerExecutionService } = require("../src/lib/execution/providers/docker.ts")
const dockerTest = process.env.RUN_DOCKER_TESTS === "1" ? test : (name, run) =>
  test(name, { skip: "Set RUN_DOCKER_TESTS=1 to execute real Docker integration tests." }, run)

test("rejects a relative DOCKER_PATH without attempting Docker execution", async () => {
  const originalDockerPath = process.env.DOCKER_PATH
  process.env.DOCKER_PATH = "docker.exe"

  try {
    await assert.rejects(
      new DockerExecutionService().execute({
        language: "c",
        code: "int main(void) { return 0; }\n",
        input: "",
        expectedOutput: "",
      }),
      /Docker CLI is unavailable\. DOCKER_PATH must be an absolute path/u,
    )
  } finally {
    if (originalDockerPath === undefined) delete process.env.DOCKER_PATH
    else process.env.DOCKER_PATH = originalDockerPath
  }
})

dockerTest("runs the application's Run Code backend flow through real Docker execution", async () => {
  let savedAttempt
  const prisma = {
    question: {
      async findUnique() {
        return {
          id: "integration-question",
          points: 10,
          round: {
            status: "ACTIVE",
            competitionId: "integration-competition",
            maxCompileAttempts: 5,
          },
        }
      },
    },
    competitionParticipant: {
      async findUnique() {
        return { id: "integration-participant" }
      },
    },
    compileAttempt: {
      async count() {
        return 0
      },
      async create({ data }) {
        savedAttempt = { id: "integration-attempt", ...data }
        return savedAttempt
      },
      async update({ data }) {
        savedAttempt = { ...savedAttempt, ...data }
        return savedAttempt
      },
    },
    testCase: {
      async findMany() {
        return [{ input: "hello\n", expected: "hello\n", isHidden: false }]
      },
    },
  }

  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === "@/lib/prisma") return { prisma }
    if (request === "./realtime" && parent?.filename === path.resolve(__dirname, "../src/lib/competition-engine.ts")) {
      return { broadcastEvent: async () => {} }
    }
    if (request === "./ai-debugger" && parent?.filename === path.resolve(__dirname, "../src/lib/competition-engine.ts")) {
      return { analyzeSubmission: async () => {}, runAICompetitionEvaluation: async () => {} }
    }
    if (request === "./code-language" && parent?.filename === path.resolve(__dirname, "../src/lib/competition-engine.ts")) {
      return originalLoad.call(this, path.resolve(__dirname, "../src/lib/code-language.ts"), parent, isMain)
    }
    if (request === "./execution" && parent?.filename === path.resolve(__dirname, "../src/lib/competition-engine.ts")) {
      return { getExecutionService: () => new DockerExecutionService() }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const { requestCompile } = require("../src/lib/competition-engine.ts")
    const attempt = await requestCompile(
      "integration-user",
      "integration-question",
      "c",
      "#include <stdio.h>\nint main(void) { char input[32]; if (fgets(input, sizeof(input), stdin)) fputs(input, stdout); return 0; }\n",
    )

    assert.equal(attempt.id, "integration-attempt")
    assert.match(attempt.result, /Verdict: Accepted \(public test case 1\)/u)
    assert.match(attempt.result, /Compiler: GCC 16\.2\./u)
    assert.match(attempt.result, /Program output:\nhello/u)
    assert.match(savedAttempt.result, /Verdict: Accepted/u)
  } finally {
    Module._load = originalLoad
  }
})

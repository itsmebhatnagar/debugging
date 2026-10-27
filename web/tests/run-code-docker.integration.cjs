/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict")
const { test } = require("node:test")
const fs = require("node:fs")
const Module = require("node:module")
const os = require("node:os")
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

function findDockerExecutable() {
  const configuredPath = process.env.DOCKER_PATH?.trim()
  if (configuredPath && fs.existsSync(configuredPath)) return path.resolve(configuredPath)

  const executableName = process.platform === "win32" ? "docker.exe" : "docker"
  return (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((directory) => path.resolve(directory, executableName))
    .find((candidate) => fs.existsSync(candidate))
}

test("reports a missing Docker executable when DOCKER_PATH and PATH do not resolve it", async () => {
  const originalDockerPath = process.env.DOCKER_PATH
  const originalPath = process.env.PATH

  try {
    delete process.env.DOCKER_PATH
    process.env.PATH = path.parse(process.execPath).root
    await assert.rejects(
      new DockerExecutionService().execute({
        language: "c",
        code: "int main(void) { return 0; }\n",
        input: "",
        expectedOutput: "",
      }),
      /Docker CLI is unavailable\. Docker CLI was not found in the backend process PATH/u,
    )
  } finally {
    if (originalDockerPath === undefined) delete process.env.DOCKER_PATH
    else process.env.DOCKER_PATH = originalDockerPath
    if (originalPath === undefined) delete process.env.PATH
    else process.env.PATH = originalPath
  }
})

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

test("rejects a configured DOCKER_PATH that does not exist", async () => {
  const originalDockerPath = process.env.DOCKER_PATH
  const missingExecutable = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "docker-path-test-")), "docker.exe")

  try {
    process.env.DOCKER_PATH = missingExecutable
    await assert.rejects(
      new DockerExecutionService().execute({
        language: "c",
        code: "int main(void) { return 0; }\n",
        input: "",
        expectedOutput: "",
      }),
      /Docker CLI is unavailable\. DOCKER_PATH does not point to an accessible Docker executable/u,
    )
  } finally {
    if (originalDockerPath === undefined) delete process.env.DOCKER_PATH
    else process.env.DOCKER_PATH = originalDockerPath
    fs.rmSync(path.dirname(missingExecutable), { recursive: true, force: true })
  }
})

test("reports an unavailable Docker Engine separately from executable discovery", async (t) => {
  const originalDockerPath = process.env.DOCKER_PATH
  const originalDockerHost = process.env.DOCKER_HOST
  const dockerExecutable = findDockerExecutable()
  if (!dockerExecutable) {
    t.skip("Docker CLI is unavailable for the Docker Engine diagnostic test.")
    return
  }

  try {
    process.env.DOCKER_PATH = dockerExecutable
    process.env.DOCKER_HOST = "tcp://127.0.0.1:1"
    await assert.rejects(
      new DockerExecutionService().execute({
        language: "c",
        code: "int main(void) { return 0; }\n",
        input: "",
        expectedOutput: "",
      }),
      /Docker Engine (?:reported an error|is unavailable)/u,
    )
  } finally {
    if (originalDockerPath === undefined) delete process.env.DOCKER_PATH
    else process.env.DOCKER_PATH = originalDockerPath
    if (originalDockerHost === undefined) delete process.env.DOCKER_HOST
    else process.env.DOCKER_HOST = originalDockerHost
  }
})

dockerTest("runs the application's Run Code backend flow through real Docker execution", async () => {
  const originalDockerPath = process.env.DOCKER_PATH
  const dockerExecutable = findDockerExecutable()
  if (!dockerExecutable) throw new Error("Docker CLI is required for the Run Code integration test.")
  process.env.DOCKER_PATH = dockerExecutable

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
    const examples = [
      {
        language: "c",
        code: "#include <stdio.h>\nint main(void) { char input[32]; if (fgets(input, sizeof(input), stdin)) fputs(input, stdout); return 0; }\n",
        compiler: /Compiler: GCC 16\.2\./u,
      },
      {
        language: "cpp",
        code: "#include <iostream>\n#include <string>\nint main() { std::string input; std::getline(std::cin, input); std::cout << input << '\\n'; }\n",
        compiler: /Compiler: G\+\+ 16\.2\./u,
      },
      {
        language: "java",
        code: "import java.io.BufferedReader;\nimport java.io.InputStreamReader;\npublic class Main { public static void main(String[] args) throws Exception { System.out.println(new BufferedReader(new InputStreamReader(System.in)).readLine()); } }\n",
        compiler: /Compiler: OpenJDK 25\./u,
      },
    ]

    for (const example of examples) {
      const attempt = await requestCompile(
        "integration-user",
        "integration-question",
        example.language,
        example.code,
      )

      assert.equal(attempt.id, "integration-attempt")
      assert.match(attempt.result, /Verdict: Accepted \(public test case 1\)/u)
      assert.match(attempt.result, example.compiler)
      assert.match(attempt.result, /Program output:\nhello/u)
      assert.match(savedAttempt.result, /Verdict: Accepted/u)
    }
  } finally {
    Module._load = originalLoad
    if (originalDockerPath === undefined) delete process.env.DOCKER_PATH
    else process.env.DOCKER_PATH = originalDockerPath
  }
})

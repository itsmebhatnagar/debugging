/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict")
const { afterEach, test } = require("node:test")
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

const { Judge0ExecutionService } = require("../src/lib/execution/providers/judge0.ts")
const originalFetch = global.fetch
const originalEnvironment = {
  JUDGE0_API_URL: process.env.JUDGE0_API_URL,
  JUDGE0_AUTHN_TOKEN: process.env.JUDGE0_AUTHN_TOKEN,
  JUDGE0_AUTHZ_TOKEN: process.env.JUDGE0_AUTHZ_TOKEN,
}

afterEach(() => {
  global.fetch = originalFetch
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

const languages = [
  { id: 41, name: "C (GCC 13.2.0)" },
  { id: 51, name: "C (GCC 14.2.0)" },
  { id: 61, name: "C++ (G++ 13.2.0)" },
  { id: 71, name: "C++ (G++ 14.2.0)" },
  { id: 81, name: "Java (OpenJDK 21.0.2)" },
  { id: 91, name: "Java (OpenJDK 23.0.2)" },
  { id: 101, name: "Python (3.13.2)" },
  { id: 111, name: "JavaScript (Node.js 22.16.0)" },
]

function configureEnvironment() {
  process.env.JUDGE0_API_URL = "https://compiler.example/api/v1"
  process.env.JUDGE0_AUTHN_TOKEN = "test-authentication-token"
  process.env.JUDGE0_AUTHZ_TOKEN = "test-authorization-token"
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function configureApi(submit) {
  const requests = []
  global.fetch = async (input, init = {}) => {
    const url = new URL(String(input))
    const body = init.body ? JSON.parse(init.body) : null
    requests.push({ url, init, body })

    if (url.pathname.endsWith("/languages")) return jsonResponse(languages)
    if (url.pathname.endsWith("/submissions")) return submit({ url, init, body, requests })
    return jsonResponse({ error: "unexpected endpoint" }, 404)
  }
  return requests
}

function completed(statusId, description, fields = {}) {
  return jsonResponse({
    status: { id: statusId, description },
    stdout: null,
    stderr: null,
    compile_output: null,
    time: "0.25",
    memory: 4096,
    exit_code: statusId === 3 || statusId === 4 ? 0 : 1,
    ...fields,
  }, 201)
}

test("uses the hosted language catalog IDs and selects the newest supported C, C++, and Java runtimes", async () => {
  configureEnvironment()
  const requests = configureApi(() => completed(3, "Accepted", {
    stdout: "token output\n",
    exit_code: 0,
  }))
  const service = new Judge0ExecutionService()
  const results = []

  for (const language of ["c", "cpp", "java"]) {
    results.push(await service.execute({
      language,
      code: "source code",
      input: "",
      expectedOutput: "token output",
    }))
  }

  assert.deepEqual(
    requests.filter(({ body }) => body?.language_id).map(({ body }) => body.language_id),
    [51, 71, 91],
  )
  assert.deepEqual(results.map(({ compilerName, compilerVersion }) => [compilerName, compilerVersion]), [
    ["GCC", "14.2.0"],
    ["G++", "14.2.0"],
    ["OpenJDK", "23.0.2"],
  ])
  assert.ok(results.every(({ verdict, passed }) => verdict === "Accepted" && passed))
})

test("applies whitespace-insensitive output comparison without sending expected output to Judge0", async () => {
  configureEnvironment()
  let requestBody
  configureApi(({ body }) => {
    requestBody = body
    return completed(3, "Accepted", { stdout: "  5\t\r\n", exit_code: 0 })
  })

  const result = await new Judge0ExecutionService().execute({
    language: "c",
    code: "source",
    input: "",
    expectedOutput: "5\n",
  })

  assert.equal(Object.hasOwn(requestBody, "expected_output"), false)
  assert.equal(result.verdict, "Accepted")
  assert.equal(result.passed, true)
})

test("returns Wrong Answer for different output", async () => {
  configureEnvironment()
  configureApi(() => completed(3, "Accepted", { stdout: "wrong", exit_code: 0 }))

  const result = await new Judge0ExecutionService().execute({
    language: "cpp",
    code: "source",
    input: "",
    expectedOutput: "right",
  })

  assert.equal(result.verdict, "Wrong Answer")
  assert.equal(result.passed, false)
})

test("maps compilation, runtime, time-limit, and internal service statuses", async () => {
  const cases = [
    { statusId: 6, status: "Compilation Error", expected: "Compilation Error", compileOutput: "compiler diagnostic" },
    { statusId: 11, status: "Runtime Error (NZEC)", expected: "Runtime Error", stderr: "runtime diagnostic", exit_code: 17 },
    { statusId: 3, status: "Accepted", expected: "Runtime Error", stdout: "wrong", exit_code: 17 },
    { statusId: 5, status: "Time Limit Exceeded", expected: "Time Limit Exceeded" },
    { statusId: 8, status: "Memory Limit Exceeded", expected: "Memory Limit Exceeded" },
    { statusId: 12, status: "Output Limit Exceeded", expected: "Output Limit Exceeded" },
    { statusId: 13, status: "Internal Error", expected: "Internal Error" },
  ]

  for (const sample of cases) {
    configureEnvironment()
    const { status, expected, statusId, ...fields } = sample
    configureApi(() => completed(statusId, status, {
      ...(fields.compileOutput ? { compile_output: fields.compileOutput } : {}),
      ...(fields.stderr ? { stderr: fields.stderr } : {}),
      ...(fields.exit_code !== undefined ? { exit_code: fields.exit_code } : {}),
    }))
    const result = await new Judge0ExecutionService().execute({
      language: "java",
      code: "source",
      input: "",
      expectedOutput: "unused",
    })

    assert.equal(result.verdict, expected)
    assert.equal(result.passed, false)
    if (sample.compileOutput) assert.equal(result.compileOutput, sample.compileOutput)
    if (sample.stderr) assert.equal(result.stderr, sample.stderr)
  }
})

test("polls queued submissions until the completed Judge0 response", async () => {
  configureEnvironment()
  const requests = []
  let polls = 0
  global.fetch = async (input, init = {}) => {
    const url = new URL(String(input))
    const body = init.body ? JSON.parse(init.body) : null
    requests.push({ url, init, body })
    if (url.pathname.endsWith("/languages")) return jsonResponse(languages)
    if (url.pathname.endsWith("/submissions")) return jsonResponse({ token: "queued-token" }, 201)
    if (url.pathname.endsWith("/submissions/queued-token")) {
      polls += 1
      return polls < 2
        ? jsonResponse({ status: { id: 2, description: "Processing" } })
        : jsonResponse({
            status: { id: 3, description: "Accepted" },
            stdout: "done",
            stderr: null,
            compile_output: null,
            time: "0.1",
            memory: 500,
            exit_code: 0,
          })
    }
    return jsonResponse({ error: "unexpected endpoint" }, 404)
  }

  const result = await new Judge0ExecutionService().execute({
    language: "c",
    code: "source",
    input: "",
    expectedOutput: "done",
  })

  assert.equal(result.verdict, "Accepted")
  assert.equal(polls, 2)
  assert.ok(requests.every(({ url }) => url.href.startsWith("https://compiler.example/api/v1/")))
  assert.ok(requests.some(({ url }) => url.searchParams.get("wait") === "false"))
  assert.ok(requests.some(({ url }) => url.pathname.endsWith("/submissions/queued-token")))
})

test("sends server-side credentials and Judge0 resource limits on every submission", async () => {
  configureEnvironment()
  let request
  configureApi(({ init, body }) => {
    request = { init, body }
    return completed(3, "Accepted", { stdout: "ok", exit_code: 0 })
  })

  await new Judge0ExecutionService().execute({
    language: "java",
    code: "source",
    input: "",
    expectedOutput: "ok",
  })

  assert.equal(request.init.headers["X-Auth-Token"], "test-authentication-token")
  assert.equal(request.init.headers["X-Auth-User"], "test-authorization-token")
  assert.equal(request.body.cpu_time_limit, 2)
  assert.equal(request.body.cpu_extra_time, 1)
  assert.equal(request.body.wall_time_limit, 5)
  assert.equal(request.body.memory_limit, 128_000)
  assert.equal(request.body.stack_limit, 64_000)
  assert.equal(request.body.max_processes_and_or_threads, 30)
  assert.equal(request.body.max_file_size, 1_024)
  assert.equal(request.body.enable_network, false)
})

test("rejects malformed code and reports missing service configuration", async () => {
  configureEnvironment()
  configureApi(() => assert.fail("must validate before making remote calls"))
  const service = new Judge0ExecutionService()

  await assert.rejects(
    service.execute({ language: "c", code: " \n", input: "", expectedOutput: "" }),
    /Source code cannot be empty/,
  )
  await assert.rejects(
    service.execute({ language: "python", code: "print(1)", input: "", expectedOutput: "" }),
    /Supported languages are C, C\+\+, and Java/,
  )

  delete process.env.JUDGE0_API_URL
  assert.throws(
    () => new Judge0ExecutionService(),
    { message: "Compiler service not configured. Set JUDGE0_API_URL to a hosted Judge0-compatible API." },
  )
})

test("surfaces remote API errors instead of creating an execution result", async () => {
  configureEnvironment()
  global.fetch = async () => new Response("service unavailable", { status: 503 })

  await assert.rejects(
    new Judge0ExecutionService().execute({
      language: "c",
      code: "source",
      input: "",
      expectedOutput: "",
    }),
    { message: "Judge0 request failed with HTTP 503: service unavailable" },
  )
})

test("rejects malformed terminal responses rather than inventing empty output or an exit code", async () => {
  configureEnvironment()
  configureApi(() => jsonResponse({
    status: { id: 3, description: "Accepted" },
    stdout: null,
    stderr: null,
    compile_output: null,
    time: null,
    memory: null,
  }, 201))

  await assert.rejects(
    new Judge0ExecutionService().execute({
      language: "c",
      code: "source",
      input: "",
      expectedOutput: "",
    }),
    /completed submission without the required execution result fields/,
  )
})

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

const { DockerExecutionService } = require("../src/lib/execution/providers/docker.ts")
const dockerTest = (name, run) => {
  if (process.env.RUN_DOCKER_TESTS === "1") return test(name, run)
  return test(name, { skip: "Set RUN_DOCKER_TESTS=1 to execute real Docker integration tests." }, () => {})
}

dockerTest("compiles and executes C, C++, and Java in Docker using actual compiler images", async (t) => {
  const service = new DockerExecutionService()
  const examples = [
    {
      language: "c",
      code: "#include <stdio.h>\nint main(void) { puts(\"c-ok\"); return 0; }\n",
      expectedCompiler: "GCC",
      expectedVersion: /^16\.2\./u,
    },
    {
      language: "cpp",
      code: "#include <iostream>\nint main() { std::cout << \"cpp-ok\\n\"; }\n",
      expectedCompiler: "G++",
      expectedVersion: /^16\.2\./u,
    },
    {
      language: "java",
      code: "public class CustomEntry { public static void main(String[] args) { System.out.println(\"java-ok\"); } }\n",
      expectedCompiler: "OpenJDK",
      expectedVersion: /^25\./u,
    },
  ]

  for (const example of examples) {
    const result = await service.execute({
      language: example.language,
      code: example.code,
      input: "",
      expectedOutput: `${example.language}-ok`,
    })
    assert.equal(result.verdict, "Accepted", JSON.stringify(result))
    assert.equal(result.passed, true)
    assert.equal(result.compilerName, example.expectedCompiler)
    assert.match(result.compilerVersion, example.expectedVersion)
    assert.equal(result.stdout.trim(), `${example.language}-ok`)
    t.diagnostic(`${result.compilerName} ${result.compilerVersion}: compiled and executed ${example.language}`)
  }

  const packagePrivateJavaClass = await service.execute({
    language: "java",
    code: "class PackageEntry { public static void main(String[] args) { System.out.println(\"java-ok\"); } }\n",
    input: "",
    expectedOutput: "java-ok",
  })
  assert.equal(packagePrivateJavaClass.verdict, "Accepted", JSON.stringify(packagePrivateJavaClass))
})

dockerTest("returns real compilation, runtime, and wrong-answer verdicts", async () => {
  const service = new DockerExecutionService()
  const base = { language: "c", input: "", expectedOutput: "expected" }

  const compilationError = await service.execute({ ...base, code: "int main( {" })
  assert.equal(compilationError.verdict, "Compilation Error", JSON.stringify(compilationError))

  const runtimeError = await service.execute({
    ...base,
    code: "#include <stdio.h>\nint main(void) { puts(\"expected\"); return 1; }\n",
  })
  assert.equal(runtimeError.verdict, "Runtime Error", JSON.stringify(runtimeError))

  const wrongAnswer = await service.execute({
    ...base,
    code: "#include <stdio.h>\nint main(void) { puts(\"different\"); return 0; }\n",
  })
  assert.equal(wrongAnswer.verdict, "Wrong Answer", JSON.stringify(wrongAnswer))
})

dockerTest("enforces wall-clock and output limits for untrusted programs", async () => {
  const service = new DockerExecutionService()

  const timeout = await service.execute({
    language: "c",
    code: "int main(void) { for (;;) {} }\n",
    input: "",
    expectedOutput: "",
  })
  assert.equal(timeout.verdict, "Time Limit Exceeded", JSON.stringify(timeout))

  const outputLimit = await service.execute({
    language: "c",
    code: "#include <stdio.h>\nint main(void) { for (;;) puts(\"output\"); }\n",
    input: "",
    expectedOutput: "",
  })
  assert.equal(outputLimit.verdict, "Output Limit Exceeded", JSON.stringify(outputLimit))
})

dockerTest("applies the configured container memory and process limits", async (t) => {
  const result = await new DockerExecutionService().execute({
    language: "c",
    code: "#include <stdio.h>\nint main(void) { char memory[32], pids[32]; FILE *m = fopen(\"/sys/fs/cgroup/memory.max\", \"r\"); FILE *p = fopen(\"/sys/fs/cgroup/pids.max\", \"r\"); if (!m || !p || !fgets(memory, sizeof(memory), m) || !fgets(pids, sizeof(pids), p)) return 1; printf(\"%s %s\", memory, pids); return 0; }\n",
    input: "",
    expectedOutput: "268435456\n64",
  })

  assert.equal(result.verdict, "Accepted", JSON.stringify(result))
  t.diagnostic("Container reported memory.max=268435456 and pids.max=64")
})

dockerTest("bounds concurrent container execution without corrupting results", async () => {
  const service = new DockerExecutionService()
  const results = await Promise.all(Array.from({ length: 6 }, (_, index) => service.execute({
    language: "c",
    code: `#include <stdio.h>\nint main(void) { puts(\"${index}\"); return 0; }\n`,
    input: "",
    expectedOutput: String(index),
  })))

  assert.ok(results.every((result) => result.verdict === "Accepted"))
})

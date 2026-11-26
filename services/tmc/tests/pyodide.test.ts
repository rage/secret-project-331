// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"

import { loadPyodide, type PyodideAPI } from "pyodide"
import { beforeAll, describe, expect, it } from "vitest"

import { getPythonBrowserTestAdapter } from "@/components/AnswerBrowserExercise/browserTest"
import { buildBrowserTestScript } from "@/tmc/browserTestScript"

const RUNNER = readFileSync(
  path.join(import.meta.dirname, "..", "public", "pythonRunner.py"),
  "utf8",
)
const FIXTURE = path.join(import.meta.dirname, "fixtures", "hello-name")
const SOLUTION = 'name = input("What is your name? ")\nprint("Hello " + name)\n'

let pyodide: PyodideAPI
let output: string[]
let prompts: string[]

beforeAll(async () => {
  pyodide = await loadPyodide()
  // What pythonWorker.js exposes to pythonRunner.py through the `js` module.
  Object.assign(globalThis, {
    requestStdinLine: (prompt: string) => {
      prompts.push(prompt)
      return Promise.resolve("Ada")
    },
  })
}, 60_000)

/** Runs `source` the way the worker's Run does; returns the error line, or null. */
async function run(source: string, blockingInput: boolean): Promise<string | null> {
  output = []
  prompts = []
  pyodide.setStdout({ batched: (line) => output.push(line) })
  const runner = pyodide.toPy({})
  pyodide.runPython(RUNNER, { globals: runner })
  runner.set("source", source)
  runner.set("blocking", blockingInput)
  const error: unknown = await pyodide.runPythonAsync(
    "await run_main(source, 'src/main.py', blocking)",
    { globals: runner },
  )
  return (error as string | undefined) ?? null
}

describe("Run", () => {
  describe.each([
    { blockingInput: true, mode: "with blocking input" },
    { blockingInput: false, mode: "without blocking input" },
  ])("$mode", ({ blockingInput }) => {
    it("reads module-level input() and shows the prompt", async () => {
      expect(await run(SOLUTION, blockingInput)).toBeNull()
      expect(prompts).toEqual(["What is your name? "])
      expect(output).toEqual(["Hello Ada"])
    })

    it("runs as __main__ with real module globals", async () => {
      const source =
        "count = 0\ndef bump():\n    global count\n    count += 1\nbump()\nprint(count, __name__)\n"
      expect(await run(source, blockingInput)).toBeNull()
      expect(output).toEqual(["1 __main__"])
    })

    it("stops at exit() without reporting an error", async () => {
      expect(await run('print("a")\nexit()\nprint("b")\n', blockingInput)).toBeNull()
      expect(output).toEqual(["a"])
    })

    it("reports the line of an error in the student's code", async () => {
      expect(await run("def f():\n    return 1 / 0\n\nf()\n", blockingInput)).toBe(
        "ZeroDivisionError on line 2: division by zero",
      )
    })

    it("does not leak the runner's imports into the student's namespace", async () => {
      expect(await run("print(ast)\n", blockingInput)).toBe(
        "NameError on line 1: name 'ast' is not defined",
      )
    })
  })

  it("reads input() inside a function when input can block", async () => {
    const source = 'def main():\n    print("Hi " + input())\n\nmain()\n'
    expect(await run(source, true)).toBeNull()
    expect(output).toEqual(["Hi Ada"])
  })
})

/** Runs the fixture's browser tests the way the worker's Test does. */
async function runBrowserTests(studentCode: string) {
  const built = await buildBrowserTestScript(FIXTURE)
  if (!("script" in built)) {
    throw new Error(built.error)
  }
  const script = getPythonBrowserTestAdapter().buildScript(built.script, studentCode)
  const lines: string[] = []
  pyodide.setStdout({ batched: (line) => lines.push(line) })
  await pyodide.runPythonAsync(script, { globals: pyodide.toPy({}) })
  return JSON.parse(lines.at(-1) ?? "") as { status: string }
}

describe("Test", () => {
  it("passes the model solution of a course-shaped exercise", async () => {
    expect((await runBrowserTests(SOLUTION)).status).toBe("PASSED")
  })

  it("fails the stub", async () => {
    expect((await runBrowserTests("# Write your solution here\n")).status).toBe("TESTS_FAILED")
  })
})

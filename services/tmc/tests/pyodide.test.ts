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
    readStdinLineSync: (prompt: string) => {
      prompts.push(prompt)
      return "Ada"
    },
  })
}, 60_000)

type InputMode = "service-worker" | "jspi" | "none"

/** Runs `source` the way the worker's Run does; returns the error line, or null. */
async function run(source: string, inputMode: InputMode | undefined): Promise<string | null> {
  output = []
  prompts = []
  pyodide.setStdout({ batched: (line) => output.push(line) })
  const runner = pyodide.toPy({})
  pyodide.runPython(RUNNER, { globals: runner })
  runner.set("source", source)
  runner.set("input_mode", inputMode)
  const error: unknown = await pyodide.runPythonAsync(
    "await run_main(source, 'src/main.py', input_mode)",
    { globals: runner },
  )
  return (error as string | undefined) ?? null
}

describe("Run", () => {
  describe.each<{ inputMode: InputMode }>([
    { inputMode: "service-worker" },
    { inputMode: "jspi" },
    { inputMode: "none" },
  ])("with input mode $inputMode", ({ inputMode }) => {
    it("reads module-level input() and shows the prompt", async () => {
      expect(await run(SOLUTION, inputMode)).toBeNull()
      expect(prompts).toEqual(["What is your name? "])
      expect(output).toEqual(["Hello Ada"])
    })

    it("runs as __main__ with real module globals", async () => {
      const source =
        "count = 0\ndef bump():\n    global count\n    count += 1\nbump()\nprint(count, __name__)\n"
      expect(await run(source, inputMode)).toBeNull()
      expect(output).toEqual(["1 __main__"])
    })

    it("stops at exit() without reporting an error", async () => {
      expect(await run('print("a")\nexit()\nprint("b")\n', inputMode)).toBeNull()
      expect(output).toEqual(["a"])
    })

    it("reports the line of an error in the student's code", async () => {
      expect(await run("def f():\n    return 1 / 0\n\nf()\n", inputMode)).toBe(
        "ZeroDivisionError on line 2: division by zero",
      )
    })

    it("does not leak the runner's imports into the student's namespace", async () => {
      expect(await run("print(ast)\n", inputMode)).toBe(
        "NameError on line 1: name 'ast' is not defined",
      )
    })
  })

  it.each<InputMode>(["service-worker", "jspi"])(
    "reads input() inside a function with input mode %s",
    async (inputMode) => {
      const source = 'def main():\n    print("Hi " + input("Name? "))\n\nmain()\n'
      expect(await run(source, inputMode)).toBeNull()
      expect(prompts).toEqual(["Name? "])
      expect(output).toEqual(["Hi Ada"])
    },
  )

  it("reads input() inside a function when the worker leaves the input mode to the runner", async () => {
    const source = 'def main():\n    print("Hi " + input("Name? "))\n\nmain()\n'
    expect(await run(source, undefined)).toBeNull()
    expect(output).toEqual(["Hi Ada"])
  })

  it("explains why input() inside a function fails when input cannot block", async () => {
    const source = "def main():\n    input()\n\nmain()\n"
    expect(await run(source, "none")).toMatch(/^RuntimeError on line 2: .*service workers/)
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
  it("passes after a Run has replaced print, stdout and the recursion limit", async () => {
    const runner = pyodide.toPy({})
    pyodide.runPython(RUNNER, { globals: runner })
    runner.set(
      "source",
      "import builtins, io, sys\nbuiltins.print = lambda *a, **k: None\nsys.stdout = io.StringIO()\nsys.setrecursionlimit(60)\n",
    )
    await pyodide.runPythonAsync("await run_main(source, 'src/main.py', 'none')", {
      globals: runner,
    })
    pyodide.runPython("reset_interpreter()", { globals: runner })
    expect((await runBrowserTests(SOLUTION)).status).toBe("PASSED")
  })

  it("passes the model solution of a course-shaped exercise", async () => {
    expect((await runBrowserTests(SOLUTION)).status).toBe("PASSED")
  })

  it("fails the stub", async () => {
    expect((await runBrowserTests("# Write your solution here\n")).status).toBe("TESTS_FAILED")
  })
})

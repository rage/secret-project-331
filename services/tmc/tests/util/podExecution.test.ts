import { mkdtemp, rm, writeFile } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import type internal from "stream"

import type * as k8s from "@kubernetes/client-node"
import { afterEach, beforeEach, describe, expect, test } from "vitest"

import type { Logger } from "@/util/logger"
import { copySubmissionToPod, runTmcAndReadOutput, testRunBudgetMs } from "@/util/podExecution"

interface FakeRun {
  exitCode: number
  stdout?: string
  stderr?: string
}

/** Records every command and answers each with the next scripted run. */
function fakeExec(runs: FakeRun[]): { exec: k8s.Exec; commands: string[][] } {
  const commands: string[][] = []
  const exec = {
    exec: (
      _namespace: string,
      _podName: string,
      _containerName: string,
      command: string[],
      stdout: internal.Writable,
      stderr: internal.Writable,
      _stdin: internal.Readable | null,
      _tty: boolean,
      statusCallback: (status: unknown) => void,
    ) => {
      commands.push(command)
      const run = runs.shift() ?? { exitCode: 0 }
      const socket: { onclose?: () => void } = {}
      setTimeout(() => {
        if (run.stdout !== undefined) {
          stdout.write(run.stdout)
        }
        if (run.stderr !== undefined) {
          stderr.write(run.stderr)
        }
        statusCallback(
          run.exitCode === 0
            ? { status: "Success" }
            : {
                status: "Failure",
                details: { causes: [{ reason: "ExitCode", message: String(run.exitCode) }] },
              },
        )
        // As the real client does when the exec's socket closes.
        stdout.end()
        stderr.end()
        setTimeout(() => socket.onclose?.(), 0)
      }, 0)
      return Promise.resolve(socket)
    },
  }
  return { exec: exec as unknown as k8s.Exec, commands }
}

const silentLogger = { log: () => {}, error: () => {} } as unknown as Logger

describe("copySubmissionToPod", () => {
  let dir: string
  let archivePath: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "pod-execution-test-"))
    archivePath = path.join(dir, "submission.tar.zst")
    await writeFile(archivePath, "archive bytes")
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test("extracts into a directory it creates rather than into the image's /app", async () => {
    const { exec, commands } = fakeExec([{ exitCode: 0 }, { exitCode: 0 }])

    await copySubmissionToPod(exec, "pod", archivePath)

    expect(commands).toEqual([
      ["mkdir", "-p", "/app/submission"],
      [
        "tar",
        "--use-compress-program",
        "zstd",
        "--extract",
        "--file",
        "-",
        "--directory",
        "/app/submission",
      ],
    ])
  })

  test("a failed extraction reports tar's stderr", async () => {
    const { exec } = fakeExec([
      { exitCode: 0 },
      { exitCode: 2, stderr: "tar: src/Main.java: Cannot open: Permission denied\n" },
    ])

    await expect(copySubmissionToPod(exec, "pod", archivePath)).rejects.toThrow(
      "tar exited with code 2: tar: src/Main.java: Cannot open: Permission denied",
    )
  })
})

describe("runTmcAndReadOutput", () => {
  test("runs /tmc-run in the submission directory and reads the output it writes under /app", async () => {
    const { exec, commands } = fakeExec([
      { exitCode: 0 },
      { exitCode: 0, stdout: '{"status":"PASSED"}' },
    ])

    const outcome = await runTmcAndReadOutput(exec, "pod", silentLogger)

    expect(commands).toEqual([
      ["sh", "-c", 'cd "$1" && exec /tmc-run', "sh", "/app/submission"],
      ["cat", "/app/test_output.txt"],
    ])
    expect(outcome).toEqual({
      timedOut: false,
      output: '{"status":"PASSED"}',
      parsed: { status: "PASSED" },
    })
  })
})

describe("runTmcAndReadOutput failures", () => {
  test("keeps the tail of the output when /tmc-run exits non-zero", async () => {
    const { exec } = fakeExec([
      { exitCode: 3, stdout: "building\n", stderr: "Rscript: not found\n" },
    ])

    const outcome = await runTmcAndReadOutput(exec, "pod", silentLogger)

    expect(outcome).toEqual({
      timedOut: false,
      output: "",
      parsed: {
        status: "GENERIC_ERROR",
        exitCode: 3,
        testResults: [],
        logs: { stdout: "building", stderr: "Rscript: not found" },
      },
    })
  })

  test("bounds the captured output", async () => {
    const { exec } = fakeExec([{ exitCode: 1, stderr: `${"x".repeat(20_000)}END` }])

    const outcome = await runTmcAndReadOutput(exec, "pod", silentLogger)

    const stderr = (outcome as { parsed: { logs: { stderr: string } } }).parsed.logs.stderr
    expect(stderr.length).toBe(8192)
    expect(stderr.endsWith("END")).toBe(true)
  })

  test("reports a timeout when /tmc-run outlasts its budget", async () => {
    const exec = {
      exec: () => Promise.resolve({}),
    } as unknown as k8s.Exec

    const outcome = await runTmcAndReadOutput(exec, "pod", silentLogger, 20)

    expect(outcome).toEqual({ timedOut: true })
  })
})

describe("testRunBudgetMs", () => {
  test("adds build overhead to the exercise's test timeout and caps it", () => {
    expect(testRunBudgetMs()).toBe(180_000)
    expect(testRunBudgetMs(300_000)).toBe(420_000)
    expect(testRunBudgetMs(60 * 60_000)).toBe(15 * 60_000)
  })
})

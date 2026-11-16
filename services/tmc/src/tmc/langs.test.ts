import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"

import { afterEach, describe, expect, it, vi } from "vitest"

import { isCliOutput } from "./cli.guard"
import { extractProject, LangsError } from "./langs"

const spawn = vi.hoisted(() => vi.fn())
vi.mock("child_process", () => ({ spawn }))

/** Stands in for a tmc-langs-cli run that prints `lines` and exits. */
function fakeCliRun(lines: string[]) {
  // oxlint-disable-next-line unicorn/prefer-event-target -- stands in for a ChildProcess, an EventEmitter
  const child = Object.assign(new EventEmitter(), {
    pid: 1,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  })
  setImmediate(() => {
    for (const line of lines) {
      child.stdout.write(`${line}\n`)
    }
    child.stdout.end()
    child.stderr.end()
    setImmediate(() => child.emit("close", 1))
  })
  return child
}

const ERROR_WITHOUT_HTTP_STATUS = {
  "output-kind": "output-data",
  status: "finished",
  message: "Failed to extract project",
  result: "error",
  data: {
    "output-data-kind": "error",
    "output-data": {
      kind: "generic",
      trace: ["Caused by: No project directory found in archive"],
    },
  },
}

afterEach(() => {
  spawn.mockReset()
  vi.restoreAllMocks()
})

describe("tmc-langs output", () => {
  it("accepts an error that names no HTTP status", () => {
    expect(isCliOutput(ERROR_WITHOUT_HTTP_STATUS)).toBe(true)
  })

  it("rejects with the reported error", async () => {
    spawn.mockReturnValue(fakeCliRun([JSON.stringify(ERROR_WITHOUT_HTTP_STATUS)]))
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const run = extractProject("archive", "out", () => undefined)
    await expect(run).rejects.toBeInstanceOf(LangsError)
    await expect(run).rejects.toMatchObject({
      rootCause: "No project directory found in archive",
    })
  })

  it("fails rather than hangs when the CLI exits without a result it recognises", async () => {
    spawn.mockReturnValue(fakeCliRun([JSON.stringify({ "output-kind": "output-data" })]))
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    await expect(extractProject("archive", "out", () => undefined)).rejects.toThrow(
      "exited with code 1 without a result",
    )
  })
})

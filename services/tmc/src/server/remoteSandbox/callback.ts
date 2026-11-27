import { z } from "zod"

import type { RunOutcome } from "@/server/gradingResult"
import { isRunResult } from "@/tmc/cli.guard"
import type { Logger } from "@/util/logger"
import { MAX_CAPTURED_RUN_LOG_BYTES } from "@/util/podExecution"

/** The sandbox kills a run after this long, whatever the exercise's own tests timeout. */
export const SANDBOX_TIME_LIMIT_SECONDS = 180

/** The body the sandbox posts to the notify URL. Every field it sends is a string. */
export const sandboxCallbackSchema = z.object({
  token: z.string(),
  status: z.enum(["finished", "failed", "timeout", "crashed", "out-of-memory"]),
  exit_code: z.string().optional(),
  test_output: z.string().optional(),
  validations: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  valgrind: z.string().optional(),
  vm_log: z.string().optional(),
  /** Set, with no exit code, when the sandbox itself failed to run the task. */
  error: z.string().optional(),
})
/** A parsed sandbox callback body. */
export type SandboxCallback = z.infer<typeof sandboxCallbackSchema>

/** A run to grade, or the sandbox's own failure to run it. */
export type CallbackOutcome = { run: RunOutcome } | { sandboxError: string }

/** What a sandbox callback says about the run. */
export function outcomeFromCallback(callback: SandboxCallback, logger: Logger): CallbackOutcome {
  const output = callback.test_output ?? ""
  const exitCode = callback.exit_code ?? ""
  const finishedRun = (parsed: unknown): CallbackOutcome => ({
    run: { timedOut: false, output, parsed, validations: parseValidations(callback, logger) },
  })
  const genericErrorRun = (extra: Record<string, unknown>): CallbackOutcome => ({
    run: {
      timedOut: false,
      output,
      parsed: {
        status: "GENERIC_ERROR",
        ...extra,
        testResults: [],
        logs: { stdout: logTail(callback.stdout), stderr: logTail(callback.stderr) },
      },
      validations: null,
    },
  })
  const status =
    callback.status === "failed" && exitCode === "137" ? "out-of-memory" : callback.status

  switch (status) {
    case "finished": {
      const parsed = parseJson(output)
      return parsed === undefined
        ? genericErrorRun({ error: "INVALID_TEST_OUTPUT_JSON" })
        : finishedRun(parsed)
    }
    case "timeout":
      return { run: { timedOut: true, timeLimitSeconds: SANDBOX_TIME_LIMIT_SECONDS } }
    case "out-of-memory":
      return { run: { outOfMemory: true } }
    case "failed": {
      if (exitCode === "") {
        return { sandboxError: callback.error ?? "no exit code" }
      }
      if (exitCode === "110") {
        // tmc-langs failed; it wrote either a run result or its own error envelope.
        const parsed = parseJson(output)
        if (isRunResult(parsed)) {
          return finishedRun(parsed)
        }
        if (parsed !== undefined) {
          logger.error("tmc-langs failed in the sandbox", JSON.stringify(parsed).slice(0, 4096))
        }
      }
      return genericErrorRun({ exitCode: exitCodeValue(exitCode) })
    }
    case "crashed":
      return genericErrorRun({ exitCode: exitCodeValue(exitCode) })
  }
}

/** The JSON value of `text`, or undefined when it is not JSON. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** `validations.json` as `/tmc-run` wrote it; the sandbox sends `"null"` or nothing when there is none. */
function parseValidations(callback: SandboxCallback, logger: Logger): unknown {
  const text = callback.validations ?? ""
  if (text === "") {
    return null
  }
  const parsed = parseJson(text)
  if (parsed === undefined) {
    logger.error("Could not parse the sandbox's validations, so the style check is skipped")
    return null
  }
  return parsed
}

function exitCodeValue(exitCode: string): number | string {
  const parsed = Number(exitCode)
  return exitCode !== "" && Number.isInteger(parsed) ? parsed : exitCode
}

function logTail(text: string | undefined): string {
  const bytes = Buffer.from(text ?? "")
  return bytes
    .subarray(Math.max(0, bytes.length - MAX_CAPTURED_RUN_LOG_BYTES))
    .toString()
    .trim()
}

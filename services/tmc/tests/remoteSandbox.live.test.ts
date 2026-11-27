// @vitest-environment node
/**
 * Grades real exercises on a running sandbox server through the `remote` path, with this test as
 * the host. Skipped unless these are set:
 *
 * - TMC_LIVE_SANDBOX_URL: the sandbox, started with SANDBOX_DISABLE_SSRF_CHECK=true because it
 *   calls back to 127.0.0.1
 * - TMC_LIVE_LANGS_CLI: a tmc-langs-cli binary
 * - TMC_LIVE_PYTHON_COURSE: a directory with tmc-vscode's test-python-course exercises
 *   `part01-01_passing_exercise` and `part01-02_failing_exercise`
 * - TMC_LIVE_SANDBOX_NOTIFY_SECRET (optional): the sandbox's SANDBOX_CALLBACK_SECRET
 */
import * as actualChildProcess from "child_process"
import { randomBytes, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { join } from "node:path"

import { temporaryDirectory } from "tempy"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"

const sandboxUrl = process.env.TMC_LIVE_SANDBOX_URL
const langsCli = process.env.TMC_LIVE_LANGS_CLI
const pythonCourse = process.env.TMC_LIVE_PYTHON_COURSE

vi.mock("child_process", async (importOriginal) => {
  const original = await importOriginal<typeof actualChildProcess>()
  return {
    ...original,
    spawn: ((command: string, ...rest: unknown[]) =>
      (original.spawn as (...args: unknown[]) => unknown)(
        command === "/app/tmc-langs-cli" ? process.env.TMC_LIVE_LANGS_CLI : command,
        ...rest,
      )) as typeof original.spawn,
  }
})
vi.mock("@/shared-module/common/errors/reportErrorOccurrence", () => ({
  reportErrorOccurrence: vi.fn(() => Promise.resolve(undefined)),
}))

const servers: Server[] = []

async function listen(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<string> {
  const server = createServer(handler)
  servers.push(server)
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port.toString()}`
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

/** The whole exercise at the archive root, as the host stores a repository exercise. */
function templateArchive(exercise: string): Buffer {
  const output = join(temporaryDirectory(), "template.tar.zst")
  actualChildProcess.execFileSync("tar", [
    "--zstd",
    "-cf",
    output,
    "-C",
    join(pythonCourse as string, exercise),
    ".",
  ])
  return readFileSync(output)
}

/** The student's files, as the editor extension submits them. */
function answerArchive(exercise: string): Buffer {
  const output = join(temporaryDirectory(), "answer.tar.zst")
  actualChildProcess.execFileSync(langsCli as string, [
    "compress-project",
    "--exercise-path",
    join(pythonCourse as string, exercise),
    "--output-path",
    output,
    "--compression",
    "zstd",
  ])
  return readFileSync(output)
}

interface ReceivedUpdate {
  claim: string | undefined
  result: ExerciseTaskGradingResult
}

describe.skipIf(!sandboxUrl || !langsCli || !pythonCourse)("grading on a live sandbox", () => {
  const archives = new Map<string, Buffer>()
  const updates = new Map<string, (update: ReceivedUpdate) => void>()
  let hostUrl: string

  beforeAll(async () => {
    const callbackUrl = await listen((req, res) => {
      void readBody(req).then(async (body) => {
        const { sandboxResultsHandlers } = await import("@/server/sandboxResults")
        const response = await sandboxResultsHandlers.POST(
          new Request("http://tmc/api/sandbox-results", {
            method: "POST",
            body: new Uint8Array(body),
          }),
        )
        res.writeHead(response.status, { "content-type": "application/json" })
        res.end(await response.text())
      })
    })
    hostUrl = await listen((req, res) => {
      const url = req.url ?? ""
      if (req.method === "GET" && archives.has(url)) {
        res.end(archives.get(url))
        return
      }
      const resolve = updates.get(url)
      if (req.method === "POST" && resolve) {
        void readBody(req).then((body) => {
          res.end("{}")
          resolve({
            claim: req.headers[EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER] as string | undefined,
            result: JSON.parse(body.toString()) as ExerciseTaskGradingResult,
          })
        })
        return
      }
      res.writeHead(404).end()
    })
    vi.stubEnv("TMC_GRADING_SANDBOX", "remote")
    vi.stubEnv("TMC_REMOTE_SANDBOX_URLS", sandboxUrl)
    vi.stubEnv("TMC_REMOTE_SANDBOX_NOTIFY_URL", `${callbackUrl}/api/sandbox-results`)
    vi.stubEnv("TMC_REMOTE_SANDBOX_NOTIFY_SECRET", process.env.TMC_LIVE_SANDBOX_NOTIFY_SECRET)
    vi.stubEnv("TMC_REMOTE_SANDBOX_TOKEN_KEY", randomBytes(32).toString("base64"))
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await Promise.all(
      servers.map(
        (server) =>
          new Promise((resolve) => {
            server.close(resolve)
          }),
      ),
    )
  })

  async function gradeOnSandbox(exercise: string): Promise<ReceivedUpdate> {
    const { handleGrade } = await import("@/server/grade")
    const submissionId = randomUUID()
    archives.set(`/files/${submissionId}/template.tar.zst`, templateArchive(exercise))
    archives.set(`/files/${submissionId}/answer.tar.zst`, answerArchive(exercise))
    const updatePath = `/grading-update/${submissionId}`
    const update = new Promise<ReceivedUpdate>((resolve) => {
      updates.set(updatePath, resolve)
    })
    const repositoryExercise = {
      id: randomUUID(),
      repository_id: randomUUID(),
      part: "part01",
      name: exercise,
      repository_url: "https://example.com/course",
      checksum: [1],
      download_url: `${hostUrl}/files/${submissionId}/template.tar.zst`,
    }
    const response = await handleGrade(
      new Request("http://tmc/api/grade", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [EXERCISE_SERVICE_GRADING_UPDATE_CLAIM_HEADER]: "live-claim",
        },
        body: JSON.stringify({
          grading_update_url: `${hostUrl}${updatePath}`,
          exercise_spec: { type: "editor", repository_exercise: repositoryExercise },
          submission_files: [
            {
              id: randomUUID(),
              name: "answer.tar.zst",
              mime: "application/zstd",
              download_url: `${hostUrl}/files/${submissionId}/answer.tar.zst`,
            },
          ],
        }),
      }),
    )
    expect(response.status).toBe(200)
    return await update
  }

  it("grades a passing exercise", { timeout: 15 * 60_000 }, async () => {
    const { claim, result } = await gradeOnSandbox("part01-01_passing_exercise")
    expect(claim).toBe("live-claim")
    expect(result).toMatchObject({
      grading_progress: "FullyGraded",
      score_given: 1,
      score_maximum: 1,
    })
  })

  it("grades a failing exercise", { timeout: 15 * 60_000 }, async () => {
    const { result } = await gradeOnSandbox("part01-02_failing_exercise")
    expect(result).toMatchObject({
      grading_progress: "FullyGraded",
      score_given: 0,
      score_maximum: 1,
      feedback_json: { status: "TESTS_FAILED" },
    })
  })
})

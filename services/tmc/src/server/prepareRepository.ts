import { promises as fs } from "fs"
import path from "node:path"

import { temporaryDirectory, temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import type {
  PreparedRepository,
  PreparedRepositoryExercise,
} from "@/shared-module/exercise-protocol/core/exerciseServiceTypes"
import { extractProject, prepareExerciseRepository } from "@/tmc/langs"
import { badRequest, jsonOk } from "@/util/apiResponse"
import { createLogger } from "@/util/logger"

import { prepareRepositoryRequestSchema } from "./requestSchemas"

const { log } = createLogger("prepare-repository")

async function postImpl(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON payload")
  }
  const parsed = prepareRepositoryRequestSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest("checkout_download_url is required")
  }
  const archivePath = temporaryFile()
  const checkout = temporaryDirectory()
  try {
    await downloadStream(parsed.data.checkout_download_url, archivePath)
    await extractProject(archivePath, checkout, log, "zstd", true)
    return jsonOk<PreparedRepository>({ exercises: await prepare(checkout) })
  } finally {
    await Promise.allSettled([
      fs.rm(archivePath, { force: true }),
      fs.rm(checkout, { recursive: true, force: true }),
    ])
  }
}

/** The checkout's exercises, each with the files preparing it wrote. */
async function prepare(checkout: string): Promise<PreparedRepositoryExercise[]> {
  const exercises = await prepareExerciseRepository(checkout, log)
  return Promise.all(
    exercises.map(async (exercise) => ({
      part: exercise.part,
      name: exercise.name,
      path: path.relative(checkout, exercise.path),
      files: await Promise.all(
        exercise.written_files.map(async (written) => ({
          path: written,
          contents: await fs.readFile(path.join(exercise.path, written), "utf8"),
        })),
      ),
      details: { plugin: exercise.plugin },
    })),
  )
}

export const handlePrepareRepository = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /prepare-repository",
})

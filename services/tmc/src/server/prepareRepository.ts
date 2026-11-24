import { promises as fs } from "fs"
import path from "node:path"

import { temporaryDirectory, temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import type {
  PreparedRepository,
  PreparedRepositoryExercise,
} from "@/shared-module/exercise-protocol/core/exerciseServiceTypes"
import {
  extractProject,
  getExercisePackagingConfiguration,
  prepareExerciseRepository,
} from "@/tmc/langs"
import { badRequest, jsonOk } from "@/util/apiResponse"
import { createLogger } from "@/util/logger"

import { prepareRepositoryRequestSchema } from "./requestSchemas"

const { log } = createLogger("prepare-repository")

const TMCPROJECT_YML = ".tmcproject.yml"

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

/** The checkout's exercises, each with the files preparing it rewrote. */
async function prepare(checkout: string): Promise<PreparedRepositoryExercise[]> {
  // tmc-langs writes an exercise's .tmcproject.yml only when the repository root has one.
  const hasRootConfig = await exists(path.join(checkout, TMCPROJECT_YML))
  const exercises = await prepareExerciseRepository(checkout, log)
  const prepared: PreparedRepositoryExercise[] = []
  for (const exercise of exercises) {
    const config = await getExercisePackagingConfiguration(exercise.path, log)
    prepared.push({
      part: exercise.part,
      name: exercise.name,
      path: path.relative(checkout, exercise.path),
      files: hasRootConfig
        ? [
            {
              path: TMCPROJECT_YML,
              contents: await fs.readFile(path.join(exercise.path, TMCPROJECT_YML), "utf8"),
            },
          ]
        : [],
      details: { plugin: config.plugin ?? null },
    })
  }
  return prepared
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const handlePrepareRepository = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /prepare-repository",
})

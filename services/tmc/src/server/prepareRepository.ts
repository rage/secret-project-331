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

/** tmc-langs processes reading exercise configurations at once while preparing one repository. */
const CONFIGURATION_READS_AT_ONCE = 8

/** The checkout's exercises, each with the files preparing it rewrote. */
async function prepare(checkout: string): Promise<PreparedRepositoryExercise[]> {
  // tmc-langs writes an exercise's .tmcproject.yml only when the repository root has one.
  const hasRootConfig = await fs.access(path.join(checkout, TMCPROJECT_YML)).then(
    () => true,
    () => false,
  )
  const exercises = await prepareExerciseRepository(checkout, log)
  const prepared: PreparedRepositoryExercise[] = []
  for (let start = 0; start < exercises.length; start += CONFIGURATION_READS_AT_ONCE) {
    const batch = exercises.slice(start, start + CONFIGURATION_READS_AT_ONCE)
    prepared.push(
      ...(await Promise.all(
        batch.map(async (exercise) => ({
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
          details: {
            plugin: (await getExercisePackagingConfiguration(exercise.path, log)).plugin ?? null,
          },
        })),
      )),
    )
  }
  return prepared
}

export const handlePrepareRepository = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /prepare-repository",
})

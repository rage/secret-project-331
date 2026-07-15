import FormData from "form-data"
import * as nodeFs from "fs"
import { promises as fsPromises } from "fs"
import { temporaryDirectory, temporaryFile } from "tempy"

import type { ParsedSpecRequest } from "./requestSchemas"
import { privateSpecSchema, specRequestSchema } from "./requestSchemas"

import { downloadStream } from "@/lib"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { isObjectMap, isString } from "@/shared-module/common/utils/fetching"
import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"
import { compressProject, extractProject, prepareSolution } from "@/tmc/langs"
import { badRequest, jsonOk } from "@/util/apiResponse"
import type { RepositoryExercise } from "@/util/exerciseServiceApi"
import { createScopedLogger } from "@/util/logger"
import type { ModelSolutionSpec } from "@/util/stateInterfaces"

async function postImpl(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON payload")
  }
  const parsed = specRequestSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest("Request was not valid.")
  }
  const specRequest = parsed.data
  const requestId = specRequest.request_id.slice(0, 4)

  let uploadClaim: string | null = null
  const uploadClaimHeader = request.headers.get(EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER)
  if (typeof uploadClaimHeader === "string") {
    uploadClaim = uploadClaimHeader
  }

  return await processModelSolution(requestId, specRequest, uploadClaim)
}

export const handleModelSolution = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /model-solution",
})

const processModelSolution = async (
  requestId: string,
  specRequest: ParsedSpecRequest,
  uploadClaim: string | null,
): Promise<Response> => {
  const { log, debug, error } = createScopedLogger("model-solution", requestId)
  const tempPaths: string[] = []
  try {
    log("Processing model solution")

    const { private_spec, upload_url } = specRequest
    if (private_spec === null || private_spec === undefined) {
      return badRequest("Missing private spec")
    }
    if (upload_url === null || upload_url === undefined) {
      return badRequest("Missing upload URL")
    }
    const privateSpecResult = privateSpecSchema.safeParse(private_spec)
    if (!privateSpecResult.success) {
      return badRequest("Invalid private spec")
    }
    const privateSpec = privateSpecResult.data

    debug("downloading template")
    const templateArchive = temporaryFile()
    tempPaths.push(templateArchive)
    await downloadStream(privateSpec.repository_exercise.download_url, templateArchive)

    debug("extracting template")
    const extractedProjectDir = temporaryDirectory()
    tempPaths.push(extractedProjectDir)
    await extractProject(templateArchive, extractedProjectDir, log)

    debug("preparing solution")
    const solutionDir = temporaryDirectory()
    tempPaths.push(solutionDir)
    await prepareSolution(extractedProjectDir, solutionDir, log)

    debug("uploading model solution")
    const { spec, paths } = await uploadModelSolution(
      log,
      debug,
      solutionDir,
      privateSpec.repository_exercise,
      upload_url,
      uploadClaim,
    )
    tempPaths.push(...paths)
    return jsonOk(spec)
  } catch (err) {
    error("Error while processing the model solution spec", err)
    throw err
  } finally {
    await Promise.allSettled(
      tempPaths.map((p) => fsPromises.rm(p, { recursive: true, force: true })),
    )
  }
}

const uploadModelSolution = async (
  log: (message: string, ...args: unknown[]) => void,
  debug: (message: string, ...args: unknown[]) => void,
  solutionDir: string,
  exercise: RepositoryExercise,
  uploadUrl: string,
  uploadClaim: string | null,
): Promise<{ spec: ModelSolutionSpec; paths: string[] }> => {
  debug("compressing solution")
  const solutionArchive = temporaryFile()
  await compressProject(solutionDir, solutionArchive, "zstd", true, log)

  const archiveName = exercise.part + "/" + exercise.name + "-solution.tar.zst"
  debug("uploading solution", "archiveName:", archiveName)
  const form = new FormData()
  form.append(archiveName, nodeFs.createReadStream(solutionArchive))
  const headers: Record<string, string> = {}
  if (uploadClaim) {
    headers[EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER] = uploadClaim
  }
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { ...headers, ...form.getHeaders() },
    body: form as unknown as RequestInit["body"],
  })
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
  }
  const resData: unknown = await res.json()
  if (
    isObjectMap(isString)(resData) &&
    Object.prototype.hasOwnProperty.call(resData, archiveName) &&
    typeof resData[archiveName] === "string"
  ) {
    const solutionDownloadUrl = resData[archiveName]
    return { spec: { solution_download_url: solutionDownloadUrl }, paths: [solutionArchive] }
  }
  throw new Error(
    `Unexpected response data: missing or invalid archive key "${archiveName}" — ${JSON.stringify(resData)}`,
  )
}

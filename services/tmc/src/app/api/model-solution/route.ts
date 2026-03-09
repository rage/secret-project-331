import axios from "axios"
import FormData from "form-data"
import * as nodeFs from "fs"
import { promises as fsPromises } from "fs"
import { temporaryDirectory, temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import { RepositoryExercise, SpecRequest } from "@/shared-module/common/bindings"
import { isSpecRequest } from "@/shared-module/common/bindings.guard"
import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "@/shared-module/common/utils/exerciseServices"
import { isObjectMap } from "@/shared-module/common/utils/fetching"
import { compressProject, extractProject, prepareSolution } from "@/tmc/langs"
import { badRequest, internalServerError, jsonOk } from "@/util/apiResponse"
import { createScopedLogger } from "@/util/logger"
import { ModelSolutionSpec, PrivateSpec } from "@/util/stateInterfaces"

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    if (!isSpecRequest(body)) {
      return badRequest("Request was not valid.")
    }
    const specRequest = body as SpecRequest
    const requestId = specRequest.request_id.slice(0, 4)

    let uploadClaim: string | null = null
    const uploadClaimHeader = request.headers.get(EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER)
    if (typeof uploadClaimHeader === "string") {
      uploadClaim = uploadClaimHeader
    }

    return await processModelSolution(requestId, specRequest, uploadClaim)
  } catch (err) {
    return internalServerError("Error while processing request", err)
  }
}

const processModelSolution = async (
  requestId: string,
  specRequest: SpecRequest,
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
    const privateSpec = private_spec as PrivateSpec

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
    return internalServerError("Error while processing the model solution spec", err)
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

  debug("uploading solution to", uploadUrl)
  const form = new FormData()
  const archiveName = exercise.part + "/" + exercise.name + "-solution.tar.zst"
  form.append(archiveName, nodeFs.createReadStream(solutionArchive))
  const headers: Record<string, string> = {}
  if (uploadClaim) {
    headers[EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER] = uploadClaim
  }
  const res = await axios.post(uploadUrl, form, { headers })
  if (isObjectMap<string>(res.data)) {
    const solutionDownloadUrl = res.data[archiveName]
    return { spec: { solution_download_url: solutionDownloadUrl }, paths: [solutionArchive] }
  } else {
    throw new Error(`Unexpected response data: ${JSON.stringify(res.data)}`)
  }
}

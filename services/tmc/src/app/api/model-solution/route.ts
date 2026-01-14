import axios from "axios"
import FormData from "form-data"
import * as fs from "fs"
import { NextResponse } from "next/server"
import { temporaryDirectory, temporaryFile } from "tempy"

import { ClientErrorResponse, downloadStream } from "@/lib"
import { RepositoryExercise, SpecRequest } from "@/shared-module/common/bindings"
import { isSpecRequest } from "@/shared-module/common/bindings.guard"
import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "@/shared-module/common/utils/exerciseServices"
import { isObjectMap } from "@/shared-module/common/utils/fetching"
import { compressProject, extractProject, prepareSolution } from "@/tmc/langs"
import { ModelSolutionSpec, PrivateSpec } from "@/util/stateInterfaces"

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json()
    if (!isSpecRequest(body)) {
      throw new Error("Request was not valid.")
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
    return internalServerError("----", "Error while processing request", err)
  }
}

const processModelSolution = async (
  requestId: string,
  specRequest: SpecRequest,
  uploadClaim: string | null,
): Promise<NextResponse> => {
  try {
    log(requestId, "Processing model solution")

    const { private_spec, upload_url } = specRequest
    if (private_spec === null || private_spec === undefined) {
      return badRequest(requestId, "Missing private spec")
    }
    if (upload_url === null || upload_url == undefined) {
      return badRequest(requestId, "Missing upload URL")
    }
    const privateSpec = private_spec as PrivateSpec

    // create model solution
    debug(requestId, "downloading template")
    const templateArchive = temporaryFile()
    await downloadStream(privateSpec.repository_exercise.download_url, templateArchive)

    debug(requestId, "extracting template")
    const extractedProjectDir = temporaryDirectory()
    await extractProject(templateArchive, extractedProjectDir, makeLog(requestId))

    debug(requestId, "preparing solution")
    const solutionDir = temporaryDirectory()
    await prepareSolution(extractedProjectDir, solutionDir, makeLog(requestId))

    let modelSolutionSpec: ModelSolutionSpec
    debug(requestId, "uploading model solution")
    modelSolutionSpec = await uploadModelSolution(
      requestId,
      solutionDir,
      privateSpec.repository_exercise,
      upload_url,
      uploadClaim,
    )
    return ok(modelSolutionSpec)
  } catch (err) {
    error(requestId, "Error while processing the model solution spec", err)
    return internalServerError(requestId, "Error while processing the model solution spec", err)
  }
}

const uploadModelSolution = async (
  requestId: string,
  solutionDir: string,
  exercise: RepositoryExercise,
  uploadUrl: string,
  uploadClaim: string | null,
): Promise<ModelSolutionSpec> => {
  debug(requestId, "compressing solution")
  const solutionArchive = temporaryFile()
  await compressProject(solutionDir, solutionArchive, "zstd", true, makeLog(requestId))

  debug(requestId, "uploading solution to", uploadUrl)
  const form = new FormData()
  const archiveName = exercise.part + "/" + exercise.name + "-solution.tar.zst"
  form.append(archiveName, fs.createReadStream(solutionArchive))
  const headers: Record<string, string> = {}
  if (uploadClaim) {
    headers[EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER] = uploadClaim
  }
  const res = await axios.post(uploadUrl, form, {
    headers,
  })
  if (isObjectMap<string>(res.data)) {
    const solutionDownloadUrl = res.data[archiveName]
    return {
      solution_download_url: solutionDownloadUrl,
    }
  } else {
    throw new Error(`Unexpected response data: ${JSON.stringify(res.data)}`)
  }
}

// response helpers

const ok = (modelSolutionSpec: ModelSolutionSpec): NextResponse => {
  return NextResponse.json(modelSolutionSpec, { status: 200 })
}

const badRequest = (requestId: string, contextMessage: string, err?: unknown): NextResponse => {
  return errorResponse(requestId, 400, contextMessage, err)
}

const internalServerError = (
  requestId: string,
  contextMessage: string,
  err?: unknown,
): NextResponse => {
  return errorResponse(requestId, 500, contextMessage, err)
}

const errorResponse = (
  requestId: string,
  statusCode: number,
  contextMessage: string,
  err?: unknown,
): NextResponse => {
  let message
  let stack = undefined
  if (err instanceof Error) {
    message = `${contextMessage}: ${err.message}`
    stack = err.stack
  } else if (typeof err === "string") {
    message = `${contextMessage}: ${err}`
  } else if (err === undefined) {
    message = contextMessage
  } else {
    // unexpected type
    message = `${contextMessage}: ${JSON.stringify(err, undefined, 2)}`
  }
  error(requestId, message, stack)
  return NextResponse.json({ message } as ClientErrorResponse, { status: statusCode })
}

// logging helpers

const log = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.log(`[model-solution/${requestId}]`, message, ...optionalParams)
}

const debug = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.debug(`[model-solution/${requestId}]`, message, ...optionalParams)
}

const error = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.error(`[model-solution/${requestId}]`, message, ...optionalParams)
}

const makeLog = (requestId: string): ((message: string, ...optionalParams: unknown[]) => void) => {
  return (message, optionalParams) => log(requestId, message, optionalParams)
}

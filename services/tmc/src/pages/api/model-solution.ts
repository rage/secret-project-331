import axios from "axios"
import FormData from "form-data"
import * as fs from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import path from "path"
import { temporaryDirectory, temporaryFile } from "tempy"

import { ClientErrorResponse, downloadStream } from "../../lib"
import {
  compressProject,
  extractProject,
  getExercisePackagingConfiguration,
  prepareSolution,
} from "../../tmc/langs"
import { ExerciseFile, ModelSolutionSpec, PrivateSpec } from "../../util/stateInterfaces"

import { RepositoryExercise, SpecRequest } from "@/shared-module/common/bindings"
import { isSpecRequest } from "@/shared-module/common/bindings.guard"
import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "@/shared-module/common/utils/exerciseServices"
import { isObjectMap } from "@/shared-module/common/utils/fetching"

export default async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  try {
    if (!isSpecRequest(req.body)) {
      throw new Error("Request was not valid.")
    }
    const specRequest = req.body as SpecRequest
    const requestId = specRequest.request_id.slice(0, 4)
    if (req.method !== "POST") {
      return badRequest(requestId, res, "Wrong method")
    }
    let uploadClaim: string | null = null
    const uploadClaimHeader = req.headers[EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER]
    if (typeof uploadClaimHeader === "string") {
      uploadClaim = uploadClaimHeader
    }

    return await processModelSolution(res, requestId, specRequest, uploadClaim)
  } catch (err) {
    return internalServerError("----", res, "Error while processing request", err)
  }
}

const processModelSolution = async (
  res: NextApiResponse<ModelSolutionSpec | ClientErrorResponse>,
  requestId: string,
  specRequest: SpecRequest,
  uploadClaim: string | null,
): Promise<void> => {
  try {
    log(requestId, "Processing model solution")

    const { private_spec, upload_url } = specRequest
    if (private_spec === null || private_spec === undefined) {
      return badRequest(requestId, res, "Missing private spec")
    }
    if (upload_url === null || upload_url == undefined) {
      return badRequest(requestId, res, "Missing upload URL")
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
    if (privateSpec.type === "browser") {
      debug(requestId, "preparing browser model solution")
      modelSolutionSpec = await prepareBrowserModelSolution(requestId, solutionDir)
    } else if (privateSpec.type === "editor") {
      debug(requestId, "preparing editor model solution")
      modelSolutionSpec = await prepareEditorModelSolution(
        requestId,
        solutionDir,
        privateSpec.repository_exercise,
        upload_url,
        uploadClaim,
      )
    } else {
      return internalServerError(requestId, res, "Unexpected private spec type", privateSpec.type)
    }
    return ok(res, modelSolutionSpec)
  } catch (err) {
    error(requestId, "Error while processing the model solution spec", err)
    return internalServerError(
      requestId,
      res,
      "Error while processing the model solution spec",
      err,
    )
  }
}

const prepareBrowserModelSolution = async (
  requestId: string,
  solutionDir: string,
): Promise<ModelSolutionSpec> => {
  const config = await getExercisePackagingConfiguration(solutionDir, makeLog(requestId))
  const solutionFiles: Array<ExerciseFile> = []
  for (const studentFilePath of config.student_file_paths) {
    const resolvedPath = path.resolve(solutionDir, studentFilePath)
    const buffer = await fs.promises.readFile(resolvedPath)
    solutionFiles.push({ filepath: studentFilePath, contents: buffer.toString() })
  }

  return {
    type: "browser",
    solution_files: solutionFiles,
  }
}

const prepareEditorModelSolution = async (
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
      type: "editor",
      download_url: solutionDownloadUrl,
    }
  } else {
    throw new Error(`Unexpected response data: ${JSON.stringify(res.data)}`)
  }
}

// response helpers

const ok = (
  res: NextApiResponse<ModelSolutionSpec>,
  modelSolutionSpec: ModelSolutionSpec,
): void => {
  res.status(200).json(modelSolutionSpec)
}

const badRequest = (
  requestId: string,
  res: NextApiResponse<ClientErrorResponse>,
  contextMessage: string,
  err?: unknown,
): void => {
  errorResponse(requestId, res, 400, contextMessage, err)
}

const internalServerError = (
  requestId: string,
  res: NextApiResponse<ClientErrorResponse>,
  contextMessage: string,
  err?: unknown,
): void => {
  errorResponse(requestId, res, 500, contextMessage, err)
}

const errorResponse = (
  requestId: string,
  res: NextApiResponse<ClientErrorResponse>,
  statusCode: number,
  contextMessage: string,
  err?: unknown,
) => {
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
  res.status(statusCode).json({ message })
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

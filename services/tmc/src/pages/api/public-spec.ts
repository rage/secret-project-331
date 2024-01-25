/* eslint-disable i18next/no-literal-string */
import axios from "axios"
import FormData from "form-data"
import * as fs from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import path from "path"
import { temporaryDirectory, temporaryFile } from "tempy"

import { ClientErrorResponse, downloadStream } from "../../lib"
import { RepositoryExercise, SpecRequest } from "../../shared-module/common/bindings"
import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "../../shared-module/common/utils/exerciseServices"
import { isObjectMap } from "../../shared-module/common/utils/fetching"
import {
  compressProject,
  extractProject,
  getExercisePackagingConfiguration,
  prepareStub,
} from "../../tmc/langs"
import { PrivateSpec, PublicSpec } from "../../util/stateInterfaces"

export default async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  try {
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

    return await processPublicSpec(res, requestId, specRequest, uploadClaim)
  } catch (err) {
    return internalServerError("----", res, "Error while processing request", err)
  }
}

async function processPublicSpec(
  res: NextApiResponse<PublicSpec | ClientErrorResponse>,
  requestId: string,
  specRequest: SpecRequest,
  uploadClaim: string | null,
): Promise<void> {
  try {
    log(requestId, "Processing public spec")

    const { private_spec, upload_url } = specRequest
    const privateSpec = private_spec as PrivateSpec | null
    if (privateSpec === null) {
      return badRequest(requestId, res, "Private spec cannot be null")
    }
    if (upload_url === null) {
      return badRequest(requestId, res, "Missing upload URL")
    }

    debug(requestId, "preparing stub dir")
    const stubDir = await prepareStubDir(requestId, privateSpec.repositoryExercise.download_url)
    let publicSpec: PublicSpec
    if (privateSpec.type === "browser") {
      debug(requestId, "preparing browser exercise")
      publicSpec = await prepareBrowserExercise(requestId, stubDir)
    } else if (privateSpec.type === "editor") {
      debug(requestId, "preparing editor exercise")
      publicSpec = await prepareEditorExercise(
        requestId,
        stubDir,
        privateSpec.repositoryExercise,
        upload_url,
        uploadClaim,
      )
    } else {
      return badRequest(requestId, res, `Unexpected private spec type: ${privateSpec.type}`)
    }
    return ok(res, publicSpec)
  } catch (err) {
    return internalServerError(requestId, res, "Error while processing the public spec", err)
  }
}

const prepareStubDir = async (requestId: string, downloadUrl: string): Promise<string> => {
  const templateArchive = temporaryFile()
  await downloadStream(downloadUrl, templateArchive)

  const templateDir = temporaryDirectory()
  debug("extracting template to", templateDir)
  await extractProject(templateArchive, templateDir, makeLog(requestId))

  const stubDir = temporaryDirectory()
  debug("preparing stub to", stubDir)
  await prepareStub(templateDir, stubDir, makeLog(requestId))
  return stubDir
}

const prepareBrowserExercise = async (requestId: string, stubDir: string): Promise<PublicSpec> => {
  log(requestId, "browser exercise, saving student files to public spec")
  const config = await getExercisePackagingConfiguration(stubDir, makeLog(requestId))
  const files = []
  for (const filepath of config.student_file_paths) {
    log(requestId, `adding ${filepath}`)
    const resolved = path.resolve(stubDir, filepath)
    const contents = await fs.promises.readFile(resolved)
    files.push({ filepath, contents: contents.toString() })
  }
  return {
    type: "browser",
    files,
  }
}

const prepareEditorExercise = async (
  requestId: string,
  stubDir: string,
  exercise: RepositoryExercise,
  uploadUrl: string,
  uploadClaim: string | null,
): Promise<PublicSpec> => {
  log(requestId, "editor exercise, uploading archive to server and saving the URL to public spec")
  const stubArchive = temporaryFile()
  debug(requestId, "compressing stub to", stubArchive)
  const checksum = await compressProject(stubDir, stubArchive, "zstd", true, makeLog(requestId))

  debug(requestId, "uploading stub to", uploadUrl)
  const form = new FormData()
  const archiveName = exercise.part + "/" + exercise.name + ".tar.zst"
  form.append(archiveName, fs.createReadStream(stubArchive))
  const headers: Record<string, string> = {}
  if (uploadClaim) {
    headers[EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER] = uploadClaim
  }
  const res = await axios.post(uploadUrl, form, {
    headers,
  })
  if (isObjectMap<string>(res.data)) {
    const archiveDownloadPath = res.data[archiveName]
    return {
      type: "editor",
      archiveName,
      archiveDownloadUrl: archiveDownloadPath,
      checksum,
    }
  } else {
    throw new Error(`Unexpected response data: ${JSON.stringify(res.data)}`)
  }
}

// response helpers

const ok = (res: NextApiResponse<PublicSpec>, publicSpec: PublicSpec): void => {
  res.status(200).json(publicSpec)
}

const badRequest = (
  requestId: string,
  res: NextApiResponse<ClientErrorResponse>,
  contextMessage: string,
  error?: unknown,
): void => {
  errorResponse(requestId, res, 400, contextMessage, error)
}

const internalServerError = (
  requestId: string,
  res: NextApiResponse<ClientErrorResponse>,
  contextMessage: string,
  error?: unknown,
): void => {
  errorResponse(requestId, res, 500, contextMessage, error)
}

const errorResponse = (
  requestId: string,
  res: NextApiResponse<ClientErrorResponse>,
  statusCode: number,
  contextMessage: string,
  err?: unknown,
) => {
  let message
  if (err instanceof Error) {
    message = `${contextMessage}: ${err.message}`
  } else if (typeof err === "string") {
    message = `${contextMessage}: ${err}`
  } else if (err === undefined) {
    message = contextMessage
  } else {
    // unexpected type
    message = `${contextMessage}: ${JSON.stringify(err, undefined, 2)}`
  }
  error(requestId, message)
  res.status(statusCode).json({ message })
}

// logging helpers

const log = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.log(`[public-spec/${requestId}]`, message, ...optionalParams)
}

const debug = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.debug(`[public-spec/${requestId}]`, message, ...optionalParams)
}

const error = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.error(`[public-spec/${requestId}]`, message, ...optionalParams)
}

const makeLog = (requestId: string): ((message: string, ...optionalParams: unknown[]) => void) => {
  return (message, optionalParams) => log(requestId, message, optionalParams)
}

/* eslint-disable i18next/no-literal-string */
import axios from "axios"
import FormData from "form-data"
import * as fs from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import path from "path"
import { temporaryDirectory, temporaryFile } from "tempy"

import { ClientErrorResponse, downloadStream } from "../../lib"
import { RepositoryExercise, SpecRequest } from "../../shared-module/bindings"
import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "../../shared-module/utils/exerciseServices"
import { isObjectMap } from "../../shared-module/utils/fetching"
import {
  compressProject,
  extractProject,
  getExercisePackagingConfiguration,
  prepareStub,
} from "../../tmc/langs"
import { PrivateSpec, PublicSpec } from "../../util/stateInterfaces"

export default async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }
  let uploadClaim: string | null = null
  const uploadClaimHeader = req.headers[EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER]
  if (typeof uploadClaimHeader === "string") {
    uploadClaim = uploadClaimHeader
  }

  return await handlePost(req, uploadClaim, res)
}

async function handlePost(
  req: NextApiRequest,
  uploadClaim: string | null,
  res: NextApiResponse<PublicSpec | ClientErrorResponse>,
): Promise<void> {
  const { request_id, private_spec, upload_url } = req.body as SpecRequest
  const requestId = request_id.slice(0, 4)

  const privateSpec = private_spec as PrivateSpec | null
  if (privateSpec === null) {
    throw new Error("Private spec cannot be null")
  }
  if (upload_url === null) {
    throw new Error("Missing upload URL")
  }

  try {
    const stubDir = await prepareStubDir(privateSpec.repositoryExercise.download_url)
    let publicSpec: PublicSpec
    if (privateSpec.type === "browser") {
      publicSpec = await prepareBrowserExercise(requestId, stubDir)
    } else if (privateSpec.type === "editor") {
      publicSpec = await prepareEditorExercise(
        requestId,
        stubDir,
        privateSpec.repositoryExercise,
        upload_url,
        uploadClaim,
      )
    } else {
      return res.status(500).json({ message: `Unexpected private spec type: ${privateSpec.type}` })
    }
    return res.status(200).json(publicSpec)
  } catch (e) {
    error(requestId, "Error while creating public spec")
    if (e instanceof Error) {
      error(requestId, "Error stack:", e.stack)
      return res.status(500).json({ message: `Internal server error: ${e.message}` })
    } else {
      error(requestId, "Unknown error", e)
      return res.status(500).json({ message: `Internal server error` })
    }
  }
}

const prepareStubDir = async (downloadUrl: string): Promise<string> => {
  const templateArchive = temporaryFile()
  await downloadStream(downloadUrl, templateArchive)

  const templateDir = temporaryDirectory()
  debug("extracting template to", templateDir)
  await extractProject(templateArchive, templateDir)

  const stubDir = temporaryDirectory()
  debug("preparing stub to", stubDir)
  await prepareStub(templateDir, stubDir)
  return stubDir
}

const prepareBrowserExercise = async (requestId: string, stubDir: string): Promise<PublicSpec> => {
  log(requestId, "browser exercise, saving student files to public spec")
  const config = await getExercisePackagingConfiguration(stubDir)
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
  await compressProject(stubDir, stubArchive, "zstd", true)

  debug(requestId, "uploading stub to", uploadUrl)
  const form = new FormData()
  const archiveName = exercise.part + "/" + exercise.name + ".tar.zst"
  form.append(archiveName, fs.createReadStream(stubArchive))
  const res = await axios.post(uploadUrl, form, {
    headers: uploadClaim ? { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER: uploadClaim } : {},
  })
  if (isObjectMap<string>(res.data)) {
    const archiveDownloadPath = res.data[archiveName]
    return {
      type: "editor",
      archiveName,
      archiveDownloadUrl: archiveDownloadPath,
    }
  } else {
    throw new Error(`Unexpected response data: ${JSON.stringify(res.data)}`)
  }
}

const log = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.log(`[public-spec/${requestId}]`, message, ...optionalParams)
}

const debug = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.debug(`[public-spec/${requestId}]`, message, ...optionalParams)
}

const error = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.error(`[public-spec/${requestId}]`, message, ...optionalParams)
}

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
  prepareSolution,
} from "../../tmc/langs"
import { ExerciseFile, ModelSolutionSpec, PrivateSpec } from "../../util/stateInterfaces"

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

const handlePost = async (
  req: NextApiRequest,
  uploadClaim: string | null,
  res: NextApiResponse<ModelSolutionSpec | ClientErrorResponse>,
): Promise<void> => {
  const { request_id, private_spec, upload_url } = req.body as SpecRequest
  const requestId = request_id.slice(0, 4)

  const privateSpec = private_spec as PrivateSpec | null
  if (privateSpec === null) {
    throw "Private spec cannot be null"
  }
  if (upload_url === null) {
    throw "Missing upload URL"
  }

  try {
    // create model solution
    debug(requestId, "downloading template")
    const templateArchive = temporaryFile()
    await downloadStream(privateSpec.repositoryExercise.download_url, templateArchive)

    debug(requestId, "extracting template")
    const extractedProjectDir = temporaryDirectory()
    await extractProject(templateArchive, extractedProjectDir)

    debug(requestId, "preparing solution")
    const solutionDir = temporaryDirectory()
    await prepareSolution(extractedProjectDir, solutionDir)

    let modelSolutionSpec: ModelSolutionSpec
    if (privateSpec.type === "browser") {
      modelSolutionSpec = await prepareBrowserModelSolution(solutionDir)
    } else if (privateSpec.type === "editor") {
      modelSolutionSpec = await prepareEditorModelSolution(
        requestId,
        solutionDir,
        privateSpec.repositoryExercise,
        upload_url,
        uploadClaim,
      )
    } else {
      return res.status(500).json({ message: `Unexpected private spec type: ${privateSpec.type}` })
    }
    return res.status(200).json(modelSolutionSpec)
  } catch (e) {
    if (e instanceof Error) {
      error(requestId, "error:", e.stack)
    }
    return res.status(500).json({ message: `Internal server error: ${JSON.stringify(e, null, 2)}` })
  }
}

const prepareBrowserModelSolution = async (solutionDir: string): Promise<ModelSolutionSpec> => {
  const config = await getExercisePackagingConfiguration(solutionDir)
  const solutionFiles: Array<ExerciseFile> = []
  for (const studentFilePath of config.student_file_paths) {
    const resolvedPath = path.resolve(solutionDir, studentFilePath)
    const buffer = await fs.promises.readFile(resolvedPath)
    solutionFiles.push({ filepath: studentFilePath, contents: buffer.toString() })
  }

  return {
    type: "browser",
    solutionFiles,
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
  await compressProject(solutionDir, solutionArchive, "zstd", true)

  debug(requestId, "uploading solution to", uploadUrl)
  const form = new FormData()
  const archiveName = exercise.part + "/" + exercise.name + "-solution.tar.zst"
  form.append(archiveName, fs.createReadStream(solutionArchive))
  const res = await axios.post(uploadUrl, form, {
    headers: uploadClaim ? { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER: uploadClaim } : {},
  })
  if (isObjectMap<string>(res.data)) {
    const solutionDownloadUrl = res.data[archiveName]
    return {
      type: "editor",
      downloadUrl: solutionDownloadUrl,
    }
  } else {
    throw new Error(`Unexpected response data: ${JSON.stringify(res.data)}`)
  }
}

const debug = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.debug(`[model-solution/${requestId}]`, message, ...optionalParams)
}

const error = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.error(`[model-solution/${requestId}]`, message, ...optionalParams)
}

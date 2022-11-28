/* eslint-disable i18next/no-literal-string */
import axios from "axios"
import { promises as fs } from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import * as path from "path"
import { temporaryDirectory, temporaryFile } from "tempy"

import { ClientErrorResponse, downloadStream } from "../../lib"
import { SpecRequest } from "../../shared-module/bindings"
import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "../../shared-module/utils/exerciseServices"
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
  const { private_spec, upload_url } = req.body as SpecRequest
  const privateSpec = private_spec as PrivateSpec | null
  if (privateSpec === null) {
    throw "Private spec cannot be null"
  }
  if (upload_url === null) {
    throw "Missing upload URL"
  }

  try {
    // create model solution
    console.debug("downloading template")
    const templateArchive = temporaryFile()
    await downloadStream(privateSpec.repositoryExercise.download_url, templateArchive)

    console.debug("extracting template")
    const extractedProjectDir = temporaryDirectory()
    await extractProject(templateArchive, extractedProjectDir)

    console.debug("preparing solution")
    const solutionDir = temporaryDirectory()
    await prepareSolution(extractedProjectDir, solutionDir)

    if (privateSpec.type === "browser") {
      await handleBrowserModelSolution(solutionDir, res)
    } else if (privateSpec.type === "editor") {
      await handleEditorModelSolution(solutionDir, upload_url, uploadClaim, res)
    } else {
      throw "unreachable"
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.stack)
    }
    return res.status(500).json({ message: `Internal server error: ${JSON.stringify(e, null, 2)}` })
  }
}

const handleBrowserModelSolution = async (
  solutionDir: string,
  res: NextApiResponse<ModelSolutionSpec | ClientErrorResponse>,
) => {
  const config = await getExercisePackagingConfiguration(solutionDir)
  const solutionFiles: Array<ExerciseFile> = []
  for (const studentFilePath of config.student_file_paths) {
    const resolvedPath = path.resolve(solutionDir, studentFilePath)
    const buffer = await fs.readFile(resolvedPath)
    solutionFiles.push({ fileName: resolvedPath, fileContents: buffer.toString() })
  }

  const modelSolutionSpec: ModelSolutionSpec = {
    type: "browser",
    solutionFiles,
  }

  return res.status(200).json(modelSolutionSpec)
}

const handleEditorModelSolution = async (
  solutionDir: string,
  uploadUrl: string,
  uploadClaim: string | null,
  res: NextApiResponse<ModelSolutionSpec | ClientErrorResponse>,
) => {
  console.debug("compressing solution")
  const solutionArchive = temporaryFile()
  await compressProject(solutionDir, solutionArchive, "zstd", true)

  console.debug("uploading solution")
  const solutionDownloadUrl = await axios.post(uploadUrl, {
    headers: uploadClaim ? { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER: uploadClaim } : {},
    file: solutionArchive,
  })
  const modelSolutionSpec: ModelSolutionSpec = {
    type: "editor",
    downloadUrl: solutionDownloadUrl.data,
  }

  return res.status(200).json(modelSolutionSpec)
}

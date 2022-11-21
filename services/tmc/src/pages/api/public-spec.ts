/* eslint-disable i18next/no-literal-string */
import axios from "axios"
import FormData from "form-data"
import * as fs from "fs"
import { NextApiRequest, NextApiResponse } from "next"
import { temporaryDirectory, temporaryFile } from "tempy"

import { ClientErrorResponse, downloadStream } from "../../lib"
import { RepositoryExercise, SpecRequest } from "../../shared-module/bindings"
import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "../../shared-module/utils/exerciseServices"
import { isString, validateResponse } from "../../shared-module/utils/fetching"
import {
  compressProject,
  extractProject,
  getExercisePackagingConfiguration,
  prepareStub,
} from "../../tmc/langs"
import { PrivateSpec, PublicSpec, publicSpecDownloadUrlRoot } from "../../util/stateInterfaces"

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
  const { private_spec, upload_url } = req.body as SpecRequest
  const privateSpec = private_spec as PrivateSpec | null
  if (privateSpec === null) {
    throw "Private spec cannot be null"
  }
  if (upload_url === null) {
    throw "Missing upload URL"
  }

  try {
    const stubDir = await prepareStubDir(privateSpec.repositoryExercise.download_url)
    let publicSpec: PublicSpec
    if (privateSpec.type === "browser") {
      publicSpec = await prepareBrowserExercise(stubDir)
    } else if (privateSpec.type === "editor") {
      publicSpec = await prepareEditorExercise(
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
    console.error("Error while creating public spec")
    if (e instanceof Error) {
      console.error("Error stack:", e.stack)
    }
    return res
      .status(500)
      .json({ message: `Internal server error: ${JSON.stringify(e, undefined, 2)}` })
  }
}

const prepareStubDir = async (downloadUrl: string): Promise<string> => {
  const templateArchive = temporaryFile()
  await downloadStream(downloadUrl, templateArchive)

  const templateDir = temporaryDirectory()
  console.debug("extracting template to", templateDir)
  await extractProject(templateArchive, templateDir)

  const stubDir = temporaryDirectory()
  console.debug("preparing stub to", stubDir)
  await prepareStub(templateDir, stubDir)
  return stubDir
}

const prepareBrowserExercise = async (stubDir: string): Promise<PublicSpec> => {
  console.log("browser exercise, saving student files to public spec")
  const config = await getExercisePackagingConfiguration(stubDir)
  const files = new Map<string, string>()
  for (const path of config.student_file_paths) {
    console.log(`adding ${path}`)
    const contents = await fs.promises.readFile(`${stubDir}/${path}`)
    files.set(path, contents.toString())
  }
  return {
    type: "browser",
    files: Array.from(files.entries()),
  }
}

const prepareEditorExercise = async (
  stubDir: string,
  exercise: RepositoryExercise,
  uploadUrl: string,
  uploadClaim: string | null,
): Promise<PublicSpec> => {
  console.log("editor exercise, uploading archive to server and saving the URL to public spec")
  const stubArchive = temporaryFile()
  console.debug("compressing stub to", stubArchive)
  await compressProject(stubDir, stubArchive, "zstd", true)
  console.debug("uploading stub to", uploadUrl)
  const form = new FormData()
  form.append("tmc-editor-exercise", fs.createReadStream(stubArchive))
  const res = await axios.post(uploadUrl, form, {
    headers: uploadClaim ? { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER: uploadClaim } : {},
  })
  const archiveDownloadPath = validateResponse(res, isString)
  return {
    type: "editor",
    archiveName: exercise.part + "/" + exercise.name + ".tar.zst",
    archiveDownloadUrl: publicSpecDownloadUrlRoot + archiveDownloadPath,
  }
}

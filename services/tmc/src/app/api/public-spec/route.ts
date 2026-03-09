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
import { buildBrowserTestScript } from "@/tmc/browserTestScript"
import {
  compressProject,
  extractProject,
  getExercisePackagingConfiguration,
  prepareStub,
} from "@/tmc/langs"
import { badRequest, internalServerError, jsonOk } from "@/util/apiResponse"
import { buildArchiveName } from "@/util/helpers"
import { createScopedLogger } from "@/util/logger"
import { PrivateSpec, PublicSpec } from "@/util/stateInterfaces"

export const runtime = "nodejs"

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    if (!isSpecRequest(body)) {
      return badRequest("Invalid spec request")
    }
    const specRequest = body as SpecRequest
    const requestId = specRequest.request_id.slice(0, 4)

    let uploadClaim: string | null = null
    const uploadClaimHeader = request.headers.get(EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER)
    if (typeof uploadClaimHeader === "string") {
      uploadClaim = uploadClaimHeader
    }

    return await processPublicSpec(requestId, specRequest, uploadClaim)
  } catch (err) {
    return internalServerError("Error while processing request", err)
  }
}

async function processPublicSpec(
  requestId: string,
  specRequest: SpecRequest,
  uploadClaim: string | null,
): Promise<Response> {
  const { log, debug } = createScopedLogger("public-spec", requestId)
  const tempPaths: string[] = []
  try {
    log("Processing public spec")

    const { private_spec, upload_url } = specRequest
    const privateSpec = private_spec as PrivateSpec | null
    if (privateSpec === null) {
      return badRequest("Private spec cannot be null")
    }
    if (upload_url === null) {
      return badRequest("Missing upload URL")
    }

    debug("preparing stub dir")
    const { stubDir, templateDir, paths } = await prepareStubDir(
      privateSpec.repository_exercise.download_url,
      log,
    )
    tempPaths.push(...paths)
    let publicSpec: PublicSpec
    debug("uploading public spec")
    const { spec, paths: uploadPaths } = await uploadPublicSpec(
      privateSpec.type,
      log,
      debug,
      stubDir,
      privateSpec.repository_exercise,
      upload_url,
      uploadClaim,
    )
    tempPaths.push(...uploadPaths)
    publicSpec = spec
    if (privateSpec.type === "browser") {
      const browserTestResult = await buildBrowserTestScript(templateDir)
      if ("script" in browserTestResult) {
        publicSpec = {
          ...publicSpec,
          browser_test: { runtime: "python", script: browserTestResult.script },
        }
      } else {
        debug("browser test script not generated:", browserTestResult.error)
        publicSpec = {
          ...publicSpec,
          browser_test: { runtime: "python", script: "", error: browserTestResult.error },
        }
      }
    }
    return jsonOk(publicSpec)
  } catch (err) {
    return internalServerError("Error while processing the public spec", err)
  } finally {
    await Promise.allSettled(
      tempPaths.map((p) => fsPromises.rm(p, { recursive: true, force: true })),
    )
  }
}

const prepareStubDir = async (
  downloadUrl: string,
  log: (message: string, ...optionalParams: unknown[]) => void,
): Promise<{ stubDir: string; templateDir: string; paths: string[] }> => {
  const templateArchive = temporaryFile()
  await downloadStream(downloadUrl, templateArchive)

  const templateDir = temporaryDirectory()
  log("extracting template to " + templateDir)
  await extractProject(templateArchive, templateDir, log)

  const stubDir = temporaryDirectory()
  log("preparing stub to " + stubDir)
  await prepareStub(templateDir, stubDir, log)

  return { stubDir, templateDir, paths: [templateArchive, templateDir, stubDir] }
}

const uploadPublicSpec = async (
  type: "browser" | "editor",
  log: (message: string, ...optionalParams: unknown[]) => void,
  debug: (message: string, ...optionalParams: unknown[]) => void,
  stubDir: string,
  exercise: RepositoryExercise,
  uploadUrl: string,
  uploadClaim: string | null,
): Promise<{ spec: PublicSpec; paths: string[] }> => {
  log("editor exercise")
  const stubArchive = temporaryFile()
  debug("compressing stub to", stubArchive)
  const checksum = await compressProject(stubDir, stubArchive, "zstd", true, log)

  debug("uploading stub to", uploadUrl)
  const form = new FormData()
  const archiveName = buildArchiveName(exercise)
  form.append(archiveName, nodeFs.createReadStream(stubArchive))
  const headers: Record<string, string> = {}
  if (uploadClaim) {
    headers[EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER] = uploadClaim
  }
  const res = await axios.post(uploadUrl, form, { headers })
  if (isObjectMap<string>(res.data)) {
    const config = await getExercisePackagingConfiguration(stubDir, log)
    const archiveDownloadPath = res.data[archiveName]
    return {
      spec: {
        type,
        archive_name: archiveName,
        stub_download_url: archiveDownloadPath,
        checksum,
        student_file_paths: config.student_file_paths,
      },
      paths: [stubArchive],
    }
  } else {
    throw new Error(`Unexpected response data: ${JSON.stringify(res.data)}`)
  }
}

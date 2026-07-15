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
import { buildBrowserTestScript } from "@/tmc/browserTestScript"
import {
  compressProject,
  extractProject,
  getExercisePackagingConfiguration,
  prepareStub,
} from "@/tmc/langs"
import { badRequest, jsonOk } from "@/util/apiResponse"
import type { RepositoryExercise } from "@/util/exerciseServiceApi"
import { buildArchiveName } from "@/util/helpers"
import { createScopedLogger } from "@/util/logger"
import type { PublicSpec } from "@/util/stateInterfaces"

async function postImpl(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON payload")
  }
  const parsed = specRequestSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest("Invalid spec request")
  }
  const specRequest = parsed.data
  const requestId = specRequest.request_id.slice(0, 4)

  const uploadClaim = request.headers.get(EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER)

  return await processPublicSpec(requestId, specRequest, uploadClaim)
}

export const handlePublicSpec = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /public-spec",
})

async function processPublicSpec(
  requestId: string,
  specRequest: ParsedSpecRequest,
  uploadClaim: string | null,
): Promise<Response> {
  const { log, debug } = createScopedLogger("public-spec", requestId)
  const tempPaths: string[] = []
  try {
    log("Processing public spec")

    const { private_spec, upload_url } = specRequest
    if (private_spec === null || private_spec === undefined) {
      return badRequest("Private spec cannot be null")
    }
    if (upload_url === null) {
      return badRequest("Missing upload URL")
    }
    const privateSpecResult = privateSpecSchema.safeParse(private_spec)
    if (!privateSpecResult.success) {
      return badRequest("Invalid private spec")
    }
    const privateSpec = privateSpecResult.data

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

  const archiveName = buildArchiveName(exercise)
  debug("uploading stub", "archiveName:", archiveName)
  const form = new FormData()
  form.append(archiveName, nodeFs.createReadStream(stubArchive))
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
    typeof resData[archiveName] === "string" &&
    resData[archiveName].length > 0
  ) {
    const config = await getExercisePackagingConfiguration(stubDir, log)
    const stub_download_url = resData[archiveName]
    return {
      spec: {
        type,
        archive_name: archiveName,
        stub_download_url,
        checksum,
        student_file_paths: config.student_file_paths,
      },
      paths: [stubArchive],
    }
  }
  throw new Error(
    `Unexpected response data: missing or invalid archive key "${archiveName}" — ${JSON.stringify(resData)}`,
  )
}

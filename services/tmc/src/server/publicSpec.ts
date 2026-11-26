import { promises as fsPromises } from "fs"
import path from "path"

import { temporaryDirectory, temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"
import { buildBrowserTestScript } from "@/tmc/browserTestScript"
import {
  compressProject,
  extractProject,
  getExercisePackagingConfiguration,
  prepareStub,
} from "@/tmc/langs"
import { badRequest, jsonOk } from "@/util/apiResponse"
import type { DerivedSpecResponse, RepositoryExercise } from "@/util/exerciseServiceApi"
import { buildArchiveName } from "@/util/helpers"
import { createScopedLogger } from "@/util/logger"
import type { PublicSpec } from "@/util/stateInterfaces"
import { comparePaths, isCoveredBy } from "@/util/studentFiles"

import type { ParsedSpecRequest } from "./requestSchemas"
import { currentRepositoryExercise, privateSpecSchema, specRequestSchema } from "./requestSchemas"
import { uploadArchive } from "./uploadArchive"

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
    const repositoryExercise = currentRepositoryExercise(specRequest, privateSpec)

    debug("preparing stub dir")
    const { stubDir, templateDir, paths } = await prepareStubDir(
      repositoryExercise.download_url,
      log,
    )
    tempPaths.push(...paths)
    let publicSpec: PublicSpec
    debug("uploading public spec")
    const {
      spec,
      files,
      testsTimeoutMs,
      paths: uploadPaths,
    } = await uploadPublicSpec(
      privateSpec.type,
      log,
      debug,
      stubDir,
      repositoryExercise,
      upload_url,
      uploadClaim,
    )
    tempPaths.push(...uploadPaths)
    publicSpec = spec
    if (privateSpec.type === "browser") {
      const timeout = testsTimeoutMs === undefined ? {} : { timeout_ms: testsTimeoutMs }
      const browserTestResult = await buildBrowserTestScript(templateDir)
      if ("script" in browserTestResult) {
        publicSpec = {
          ...publicSpec,
          browser_test: { runtime: "python", script: browserTestResult.script, ...timeout },
        }
      } else {
        debug("browser test script not generated:", browserTestResult.error)
        publicSpec = {
          ...publicSpec,
          browser_test: { runtime: "python", script: "", error: browserTestResult.error },
        }
      }
      publicSpec = {
        ...publicSpec,
        ...(await browserEditorFields(stubDir, publicSpec.student_file_paths, repositoryExercise)),
      }
    }
    // The envelope, not the bare spec: this service declares `declares_spec_files`, so it has to
    // tell the host which stored files the spec references. The stub archive is uploaded during
    // this very derivation, so nothing else could tell the host it is in use.
    return jsonOk<DerivedSpecResponse<PublicSpec>>({ spec: publicSpec, files })
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
): Promise<{
  spec: PublicSpec
  files: string[]
  testsTimeoutMs: number | undefined
  paths: string[]
}> => {
  log("editor exercise")
  const stubArchive = temporaryFile()
  debug("compressing stub to", stubArchive)
  const checksum = await compressProject(stubDir, stubArchive, "zstd", true, log)

  const archiveName = buildArchiveName(exercise)
  debug("uploading stub", "archiveName:", archiveName)
  const stub = await uploadArchive({
    archivePath: stubArchive,
    archiveName,
    uploadUrl,
    uploadClaim,
  })
  const config = await getExercisePackagingConfiguration(stubDir, log)
  return {
    spec: {
      type,
      archive_name: archiveName,
      stub_download_url: stub.url,
      checksum,
      student_file_paths: config.student_file_paths.toSorted(comparePaths),
    },
    files: [stub.id],
    testsTimeoutMs: config.tests_timeout_ms,
    paths: [stubArchive],
  }
}

/** Every file under `dir`, as `/`-separated paths relative to it. */
async function listFiles(dir: string): Promise<string[]> {
  const entries = await fsPromises.readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"),
    )
}

/** `exercise = 'src.module'` in a tmc Python test names the module under test. */
const TESTED_MODULE_PATTERN = /^\s*exercise\s*=\s*["']([\w.]+)["']/m

/**
 * The spec fields the browser editor needs to show and pack the stub's student files.
 * `studentFilePaths` is tmc-langs' packaging configuration for the stub.
 */
export async function browserEditorFields(
  stubDir: string,
  studentFilePaths: readonly string[],
  exercise: RepositoryExercise,
): Promise<Pick<PublicSpec, "student_file_paths" | "main_file" | "archive_prefix">> {
  const stubFiles = await listFiles(stubDir)
  const studentFiles = stubFiles
    .filter((file) => isCoveredBy(file, studentFilePaths))
    .toSorted(comparePaths)

  const testSources = await Promise.all(
    stubFiles
      .filter((f) => f.startsWith("test/") && f.endsWith(".py"))
      .toSorted(comparePaths)
      .map((testFile) => fsPromises.readFile(path.join(stubDir, testFile), "utf8")),
  )
  const testedFiles = testSources.flatMap((source) => {
    const testedModule = TESTED_MODULE_PATTERN.exec(source)?.[1]
    return testedModule === undefined ? [] : [`${testedModule.replaceAll(".", "/")}.py`]
  })
  const mainFile =
    testedFiles.find((file) => studentFiles.includes(file)) ??
    studentFiles.find((file) => !file.endsWith("__init__.py")) ??
    studentFiles[0]

  return {
    student_file_paths: studentFiles,
    ...(mainFile === undefined ? {} : { main_file: mainFile }),
    archive_prefix: exercise.name.replaceAll(/[^\w.-]/g, "_").replace(/^\.+$/, "exercise"),
  }
}

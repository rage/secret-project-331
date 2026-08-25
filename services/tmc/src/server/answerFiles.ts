import { promises as fs } from "fs"

import { temporaryDirectory, temporaryFile } from "tempy"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, internalServerError, jsonOk } from "@/util/apiResponse"
import { compressBrowserAnswer } from "@/util/browserAnswerArchive"
import { createLogger } from "@/util/logger"

import { answerFilesRequestSchema } from "./requestSchemas"

const { log } = createLogger("answer-files")

const DEFAULT_ARCHIVE_NAME = "submission.tar.zst"

/**
 * Tells the host which files one of this service's answers consists of, so that an answer made in
 * the IFrame is recorded in the host's file records and is downloadable exactly like one a native
 * client uploaded. The host cannot do this itself: the answer is this service's own shape.
 *
 * Always exactly one project archive, whichever answer shape it started from. A native client
 * submits one archive, so reporting a browser answer's source files individually would make the
 * same submission download as N files from one origin and 1 from the other — and an editor
 * restoring it overlays an archive, not loose files.
 *
 * Bytes, never a host file id, even where the answer already carries one. The answer is
 * student-supplied data, so an id in it would have to be re-authorized against the student before
 * the host could serve the file back, and getting that wrong reads out other people's files.
 */
async function postImpl(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON payload")
  }
  const parsed = answerFilesRequestSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest("Request was not valid.")
  }
  const answer = parsed.data.answer
  const name = parsed.data.public_spec?.archive_name ?? DEFAULT_ARCHIVE_NAME

  if (answer.type === "editor") {
    // An editor answer references a host-stored archive rather than carrying it, so the bytes have
    // to be fetched back. Only reached for an editor exercise answered in the IFrame; a native
    // client names its uploads in the submit and the host never asks.
    try {
      const response = await fetch(answer.archive_download_url)
      if (!response.ok) {
        return internalServerError(
          `Failed to fetch the submitted archive: ${response.status.toString()}`,
        )
      }
      return jsonOk(oneArchive(name, Buffer.from(await response.arrayBuffer())))
    } catch (error) {
      return internalServerError("Failed to fetch the submitted archive", error)
    }
  }

  if (answer.files.length === 0) {
    return jsonOk({ files: [] })
  }
  const dir = temporaryDirectory()
  const archivePath = temporaryFile()
  try {
    await compressBrowserAnswer(dir, archivePath, answer.files, log)
    return jsonOk(oneArchive(name, await fs.readFile(archivePath)))
  } catch (error) {
    return internalServerError("Failed to pack the answer's files into an archive", error)
  } finally {
    await Promise.allSettled(
      [dir, archivePath].map((p) => fs.rm(p, { recursive: true, force: true })),
    )
  }
}

function oneArchive(name: string, contents: Buffer) {
  return {
    files: [{ name, data: contents.toString("base64"), mime: "application/octet-stream" }],
  }
}

export const handleAnswerFiles = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /api/answer-files",
})

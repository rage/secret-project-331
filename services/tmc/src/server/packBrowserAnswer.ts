import { promises as fs } from "fs"

import { temporaryDirectory, temporaryFile } from "tempy"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, internalServerError } from "@/util/apiResponse"
import { compressBrowserAnswer } from "@/util/browserAnswerArchive"
import { createLogger } from "@/util/logger"

import { packBrowserAnswerRequestSchema } from "./requestSchemas"

const { log } = createLogger("pack-browser-answer")

const ARCHIVE_MIME = "application/x-zstd-compressed-tar"

/**
 * Packs the files of a browser answer into the project archive that answer consists of, and returns
 * its bytes for the iframe to upload. The iframe cannot do this itself: its tar/zstd libraries only
 * read archives, and tmc-langs is a native CLI.
 */
async function postImpl(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON payload")
  }
  const parsed = packBrowserAnswerRequestSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest("Expected a non-empty array of answer files")
  }
  const dir = temporaryDirectory()
  const archivePath = temporaryFile()
  try {
    await compressBrowserAnswer(dir, archivePath, parsed.data, log)
    const archive = await fs.readFile(archivePath)
    return new Response(archive, { status: 200, headers: { "content-type": ARCHIVE_MIME } })
  } catch (error) {
    return internalServerError("Failed to pack the answer's files into an archive", error)
  } finally {
    await Promise.allSettled(
      [dir, archivePath].map((p) => fs.rm(p, { recursive: true, force: true })),
    )
  }
}

export const handlePackBrowserAnswer = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /api/pack-browser-answer",
})

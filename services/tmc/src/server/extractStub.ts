import { promises as fs } from "fs"
import { temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, jsonOk } from "@/util/apiResponse"
import { extractTarZstd } from "@/util/helpers"

type ExtractStubBody = { stub_download_url?: string }

async function postImpl(request: Request): Promise<Response> {
  let body: ExtractStubBody
  try {
    body = (await request.json()) as ExtractStubBody
  } catch {
    return badRequest("invalid JSON body")
  }
  const stubDownloadUrl = body?.stub_download_url
  if (typeof stubDownloadUrl !== "string" || stubDownloadUrl.length === 0) {
    return badRequest("stub_download_url is required")
  }
  const tmpPath = temporaryFile()
  try {
    await downloadStream(stubDownloadUrl, tmpPath)
    const buffer = await fs.readFile(tmpPath)
    const files = await extractTarZstd(buffer)
    return jsonOk({ files })
  } finally {
    await fs.rm(tmpPath, { force: true }).catch(() => {})
  }
}

export const handleExtractStub = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /extract-stub",
})

import { promises as fs } from "fs"
import { temporaryFile } from "tempy"

import { extractStubRequestSchema } from "./requestSchemas"

import { downloadStream } from "@/lib"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, jsonOk } from "@/util/apiResponse"
import { extractTarZstd } from "@/util/helpers"

async function postImpl(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("invalid JSON body")
  }
  const parsed = extractStubRequestSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest("stub_download_url is required")
  }
  const stubDownloadUrl = parsed.data.stub_download_url
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

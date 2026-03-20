import { promises as fs } from "fs"
import { temporaryFile } from "tempy"

import { downloadStream } from "@/lib"
import { badRequest, internalServerError, jsonOk } from "@/util/apiResponse"
import { extractTarZstd } from "@/util/helpers"

export const runtime = "nodejs"

type ExtractStubBody = { stub_download_url?: string }

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ExtractStubBody
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
  } catch (err) {
    return internalServerError("Error extracting stub", err)
  }
}

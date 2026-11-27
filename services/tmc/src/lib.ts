import * as fs from "fs"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import type { ReadableStream as WebReadableStream } from "stream/web"

import * as k8s from "@kubernetes/client-node"

export function initKube(): { config: k8s.KubeConfig; api: k8s.CoreV1Api } {
  const config = new k8s.KubeConfig()
  config.loadFromDefault()
  const api = config.makeApiClient(k8s.CoreV1Api)
  return { config, api }
}

export interface ClientErrorResponse {
  message: string
}

export interface ExerciseFeedback {
  stdout: string
  stderr: string
}

/** Bounds a whole download, body included, so a stalled transfer cannot hold a grading slot. */
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000

export const downloadStream = async (
  url: string,
  target: string,
  timeoutMs: number = DOWNLOAD_TIMEOUT_MS,
) => {
  console.debug("downloading", url, "to", target)
  const signal = AbortSignal.timeout(timeoutMs)
  const templateRes = await fetch(url, { signal })
  if (!templateRes.ok) {
    throw new Error(`Download failed: ${templateRes.status} ${templateRes.statusText}`)
  }
  if (!templateRes.body) {
    throw new Error("Download failed: empty response body")
  }
  const templateWriter = fs.createWriteStream(target)
  await pipeline(
    Readable.fromWeb(templateRes.body as unknown as WebReadableStream),
    templateWriter,
    { signal },
  )
}

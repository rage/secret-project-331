import "@/utils/Gutenberg/headlessDom"
import "@wordpress/format-library"
import { parentPort } from "worker_threads"

import { ensureStandaloneGutenbergBootstrap } from "@/utils/Gutenberg/bootstrapStandaloneGutenberg"

import { buildBlockSchemas } from "./blockSchemas"
import type { WorkerReply, WorkerRequest } from "./protocol"
import { validateBlocks } from "./validateBlocks"

if (!parentPort) {
  throw new Error("The block validator runs as a worker thread.")
}
const port = parentPort

ensureStandaloneGutenbergBootstrap()
const blockSchemas = buildBlockSchemas()

port.on("message", (request: WorkerRequest) => {
  let reply: WorkerReply
  try {
    if (request.kind === "validate") {
      reply = { id: request.id, ...validateBlocks(request.body) }
    } else {
      reply = { id: request.id, status: 200, body: blockSchemas }
    }
  } catch (error) {
    console.error("Block validator failed on a request", error)
    // Not 5xx: headless-lms retries those, and this input fails the same way every time.
    reply = {
      id: request.id,
      status: 422,
      body: {
        error: `The validator failed on this request: ${error instanceof Error ? error.message : String(error)}`,
      },
    }
  }
  port.postMessage(reply)
})

port.postMessage({ kind: "ready" })

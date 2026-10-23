import "./domEnvironment"
import "@wordpress/format-library"
import { parentPort } from "worker_threads"

import { ensureStandaloneGutenbergBootstrap } from "@/utils/Gutenberg/bootstrapStandaloneGutenberg"

import { buildBlockSchemas, type BlockSchemasDocument } from "./blockSchemas"
import type { WorkerReply, WorkerRequest } from "./protocol"
import { validateBlocks } from "./validateBlocks"

if (!parentPort) {
  throw new Error("The block validator runs as a worker thread.")
}
const port = parentPort

ensureStandaloneGutenbergBootstrap()
let blockSchemas: BlockSchemasDocument | null = null

port.on("message", (request: WorkerRequest) => {
  let reply: WorkerReply
  try {
    if (request.kind === "validate") {
      reply = { id: request.id, ...validateBlocks(request.body) }
    } else {
      blockSchemas ??= buildBlockSchemas()
      reply = { id: request.id, status: 200, body: blockSchemas }
    }
  } catch (error) {
    reply = {
      id: request.id,
      status: 500,
      body: { error: error instanceof Error ? (error.stack ?? error.message) : String(error) },
    }
  }
  port.postMessage(reply)
})

blockSchemas = buildBlockSchemas()
port.postMessage({ kind: "ready" })

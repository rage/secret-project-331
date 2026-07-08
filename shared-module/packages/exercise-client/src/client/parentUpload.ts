import { FileUploadMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isUploadResultMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"

/**
 * The subset of {@link MessagePort} this client needs. Declaring it as an interface (rather than
 * depending on the DOM `MessagePort`) keeps the client easy to unit test with a fake port. A real
 * `MessagePort` is structurally assignable to this.
 */
export interface UploadCapableMessagePort {
  postMessage(message: unknown): void
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void
}

/** Thrown when the parent reports an upload failure (or the client is disposed mid-upload). */
export class FileUploadError extends Error {}

/**
 * Lets an exercise running inside the iframe ask the parent window to upload files and await the
 * stored URLs. Plugins never store data themselves — the host owns storage — so file attachments go
 * through the parent: the exercise sends a `file-upload` message and the parent replies with an
 * `upload-result`.
 *
 * This mirrors {@link ParentDialogClient}: it adds a request/response round-trip on top of the
 * otherwise fire-and-forget protocol by tagging every {@link FileUploadMessage} with a unique
 * `requestId` and resolving the matching promise when the parent replies with an
 * `UploadResultMessage` carrying the same id. Multiple uploads can therefore be in flight at once —
 * callers no longer have to serialize them.
 *
 * The `port` is already "started" by `useExerciseServiceParentConnection` (which sets `onmessage`),
 * so the extra `message` listener registered here also receives messages — both a `MessagePort`'s
 * `onmessage` handler and its `addEventListener` listeners fire for each message.
 */
export class ParentUploadClient {
  private readonly port: UploadCapableMessagePort
  private readonly pending = new Map<
    string,
    { resolve: (urls: Map<string, string>) => void; reject: (error: Error) => void }
  >()
  private readonly listener: (event: MessageEvent) => void
  private nextId = 0
  private disposed = false

  constructor(port: UploadCapableMessagePort) {
    this.port = port
    this.listener = (event) => this.handleMessage(event.data)
    this.port.addEventListener("message", this.listener)
  }

  /**
   * Asks the parent to upload `files` (a `Map` of name -> `File`/`Blob`/string). Resolves with a
   * `Map` of name -> stored URL on success, rejects with a {@link FileUploadError} if the parent
   * reports failure or the client is disposed before the reply arrives.
   */
  uploadFiles(files: Map<string, string | Blob>): Promise<Map<string, string>> {
    if (this.disposed) {
      return Promise.reject(new FileUploadError("Upload client has been disposed"))
    }
    const requestId = this.generateRequestId()
    const message: FileUploadMessage = { message: "file-upload", requestId, files }
    return new Promise<Map<string, string>>((resolve, reject) => {
      // Register the resolver before posting so a response can never race ahead of it.
      this.pending.set(requestId, { resolve, reject })
      this.port.postMessage(message)
    })
  }

  /** Removes the message listener and rejects any still-pending uploads. */
  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.port.removeEventListener("message", this.listener)
    for (const { reject } of this.pending.values()) {
      reject(new FileUploadError("Upload client was disposed before the upload completed"))
    }
    this.pending.clear()
  }

  private handleMessage(data: unknown): void {
    if (!isUploadResultMessage(data)) {
      return
    }
    // Correlate by requestId. A parent that predates correlation may omit it; in that case fall back
    // to the single in-flight upload so behaviour is never worse than the old one-at-a-time model.
    const entry =
      data.requestId != null
        ? this.pending.get(data.requestId)
        : this.pending.size === 1
          ? this.pending.values().next().value
          : undefined
    if (!entry) {
      // Unknown / already-resolved id, or an ambiguous uncorrelated reply; ignore.
      return
    }
    if (data.requestId != null) {
      this.pending.delete(data.requestId)
    } else {
      this.pending.clear()
    }
    if (data.success) {
      entry.resolve(data.urls)
    } else {
      entry.reject(new FileUploadError(data.error))
    }
  }

  private generateRequestId(): string {
    // A monotonic counter is enough: ids only need to be unique within this client, and the parent
    // echoes the id back on the same port, so ids never need to be globally unique.
    this.nextId += 1
    return `file-upload-${this.nextId}`
  }
}

import type { FileUploadMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isUploadResultMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"

/**
 * The subset of {@link MessagePort} this client needs. Declaring it as an interface (rather than
 * depending on the DOM `MessagePort`) keeps the client easy to unit test with a fake port. A real
 * `MessagePort` is structurally assignable to this.
 */
export interface UploadCapableMessagePort {
  postMessage: (message: unknown) => void
  addEventListener: (type: "message", listener: (event: MessageEvent) => void) => void
  removeEventListener: (type: "message", listener: (event: MessageEvent) => void) => void
}

/** Thrown when the parent reports an upload failure (or the client is disposed mid-upload). */
export class FileUploadError extends Error {}

export interface ParentUploadClientOptions {
  /**
   * How long to wait for the parent's `upload-result` before rejecting. Guards against a host that
   * never answers — e.g. one predating file-upload support, or a reply that can't be correlated.
   * Uploads of large files over slow links are legitimately slow, so the default is generous.
   * Default: 120000 (2 minutes).
   */
  timeoutMs?: number
}

const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000

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
 * callers no longer have to serialize them. Every upload has a timeout so the promise always settles
 * even if the parent never replies (see {@link ParentUploadClientOptions.timeoutMs}).
 *
 * The `port` is already "started" by `useExerciseServiceParentConnection` (which sets `onmessage`),
 * so the extra `message` listener registered here also receives messages — both a `MessagePort`'s
 * `onmessage` handler and its `addEventListener` listeners fire for each message.
 */
// oxlint-disable-next-line max-classes-per-file -- FileUploadError is the tiny error this client throws; they belong together
export class ParentUploadClient {
  private readonly port: UploadCapableMessagePort
  private readonly timeoutMs: number
  private readonly pending = new Map<
    string,
    {
      resolve: (urls: Map<string, string>) => void
      reject: (error: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  private readonly listener: (event: MessageEvent) => void
  private nextId = 0
  private disposed = false

  public constructor(port: UploadCapableMessagePort, options: ParentUploadClientOptions = {}) {
    this.port = port
    this.timeoutMs = options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS
    this.listener = (event) => this.handleMessage(event.data)
    this.port.addEventListener("message", this.listener)
  }

  /**
   * Asks the parent to upload `files` (a `Map` of name -> `File`/`Blob`/string). Resolves with a
   * `Map` of name -> stored URL on success, rejects with a {@link FileUploadError} if the parent
   * reports failure or the client is disposed before the reply arrives.
   */
  public uploadFiles(files: Map<string, string | Blob>): Promise<Map<string, string>> {
    if (this.disposed) {
      return Promise.reject(new FileUploadError("Upload client has been disposed"))
    }
    const requestId = this.generateRequestId()
    const message: FileUploadMessage = { message: "file-upload", requestId, files }
    return new Promise<Map<string, string>>((resolve, reject) => {
      // Reject rather than hang forever if the parent never replies — a host that predates
      // file-upload support ignores the message, and an uncorrelated reply is dropped when it's
      // ambiguous (see handleMessage). Without this the promise would never settle.
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(
          new FileUploadError(
            `The parent window did not respond to the file upload within ${this.timeoutMs}ms`,
          ),
        )
      }, this.timeoutMs)
      // Register the resolver before posting so a response can never race ahead of it.
      this.pending.set(requestId, { resolve, reject, timer })
      // oxlint-disable-next-line require-post-message-target-origin -- MessagePort.postMessage takes no targetOrigin (that arg is window-only)
      this.port.postMessage(message)
    })
  }

  /** Removes the message listener and rejects any still-pending uploads. */
  public dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.port.removeEventListener("message", this.listener)
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer)
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
    // When the id is missing and several uploads are pending the reply is ambiguous — we never guess
    // (matching the wrong upload would resolve it with another's URLs), so it's dropped and each
    // upload's timeout settles its promise instead.
    const entry =
      // oxlint-disable-next-line eqeqeq -- `!= null` intentionally matches both null and undefined (requestId is `string | null | undefined`)
      data.requestId != null
        ? this.pending.get(data.requestId)
        : this.pending.size === 1
          ? this.pending.values().next().value
          : undefined
    if (!entry) {
      // Unknown / already-resolved id, or an ambiguous uncorrelated reply; ignore.
      return
    }
    clearTimeout(entry.timer)
    // oxlint-disable-next-line eqeqeq -- `!= null` intentionally matches both null and undefined (requestId is `string | null | undefined`)
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

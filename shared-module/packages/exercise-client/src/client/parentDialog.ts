import type { OpenDialogMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isDialogResponseMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"

/**
 * Options for a dialog an exercise asks the parent to show. Strings are expected to be already
 * localized by the exercise (it owns its own i18n and knows the active language).
 */
export interface OpenDialogOptions {
  /**
   * "confirm" shows confirm + cancel buttons and resolves to the user's choice.
   * "warning" shows a single acknowledge button and resolves to `true` once dismissed.
   */
  dialogType: "confirm" | "warning"
  title: string
  /** Body paragraphs; each entry is rendered as its own paragraph. */
  body: string[]
  confirmButtonLabel?: string | null
  cancelButtonLabel?: string | null
}

/**
 * The subset of {@link MessagePort} this client needs. Declaring it as an interface (rather than
 * depending on the DOM `MessagePort`) keeps the client easy to unit test with a fake port. A real
 * `MessagePort` is structurally assignable to this.
 */
export interface DialogCapableMessagePort {
  postMessage(message: unknown): void
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void
}

/**
 * Lets an exercise running inside the iframe ask the parent window to open a dialog and await the
 * user's response.
 *
 * The exercise-service protocol is otherwise fire-and-forget; this client adds the request/response
 * round-trip by tagging every {@link OpenDialogMessage} with a unique `requestId` and resolving the
 * matching promise when the parent replies with a `DialogResponseMessage` carrying the same id.
 * Multiple dialogs can therefore be in flight concurrently.
 *
 * The `port` is already "started" by `useExerciseServiceParentConnection` (which sets `onmessage`),
 * so the extra `message` listener registered here also receives messages — both a `MessagePort`'s
 * `onmessage` handler and its `addEventListener` listeners fire for each message.
 */
export class ParentDialogClient {
  private readonly port: DialogCapableMessagePort
  private readonly pending = new Map<string, (confirmed: boolean) => void>()
  private readonly listener: (event: MessageEvent) => void
  private nextId = 0
  private disposed = false

  public constructor(port: DialogCapableMessagePort) {
    this.port = port
    this.listener = (event) => this.handleMessage(event.data)
    this.port.addEventListener("message", this.listener)
  }

  /**
   * Asks the parent to open a dialog. Resolves with the user's choice: `true` if the user confirmed
   * (or acknowledged a warning), `false` if they cancelled. Resolves `false` if the client has been
   * disposed.
   */
  public openDialog(options: OpenDialogOptions): Promise<boolean> {
    if (this.disposed) {
      return Promise.resolve(false)
    }
    const requestId = this.generateRequestId()
    const message: OpenDialogMessage = {
      message: "open-dialog",
      requestId,
      dialogType: options.dialogType,
      title: options.title,
      body: options.body,
      confirmButtonLabel: options.confirmButtonLabel ?? null,
      cancelButtonLabel: options.cancelButtonLabel ?? null,
    }
    return new Promise<boolean>((resolve) => {
      // Register the resolver before posting so a response can never race ahead of it.
      this.pending.set(requestId, resolve)
      this.port.postMessage(message)
    })
  }

  /** Removes the message listener and resolves any still-pending dialogs as not confirmed. */
  public dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.port.removeEventListener("message", this.listener)
    for (const resolve of this.pending.values()) {
      resolve(false)
    }
    this.pending.clear()
  }

  private handleMessage(data: unknown): void {
    if (!isDialogResponseMessage(data)) {
      return
    }
    const resolve = this.pending.get(data.requestId)
    if (!resolve) {
      // Unknown or already-resolved request id; ignore.
      return
    }
    this.pending.delete(data.requestId)
    resolve(data.confirmed)
  }

  private generateRequestId(): string {
    // A monotonic counter is enough: ids only need to be unique within this client, and the parent
    // echoes the id back on the same port, so ids never need to be globally unique.
    this.nextId += 1
    return `open-dialog-${this.nextId}`
  }
}

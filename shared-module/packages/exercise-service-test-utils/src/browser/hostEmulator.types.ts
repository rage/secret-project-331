// Types for the injectable emulator in ./hostEmulator.js / ./hostEmulatorSource.ts. The emulator is
// plain JS (it must `eval` standalone), so its shape is described here rather than in a `.d.ts`
// beside the `.js`.

/** Any recorded protocol message. Carries at least the `message` discriminator. */
export interface RecordedMessage {
  message: string
  [key: string]: unknown
}

/** Payload for `sendUploadResult`: ordered host-assigned files, or an error. */
export interface UploadResultInput {
  files?: { id: string; url: string }[]
  error?: string
}

/** A serialization-safe description of one value in a `file-upload` payload. */
export interface FileUploadEntrySnapshot {
  key: string
  kind: "file" | "blob" | "string" | "unsupported"
  name: string | null
  type: string | null
  size: number | null
  lastModified: number | null
  sha256: string | null
}

/** A browser-realm snapshot of a `file-upload`, including the bytes of every Blob/File. */
export interface FileUploadSnapshot {
  requestId: string | null
  filesKind: "array" | "plain-object" | "map" | "missing" | "other"
  entries: FileUploadEntrySnapshot[]
}

export interface HostEmulatorOptions {
  /** Auto-answer `file-upload` with fake stored URLs (default true). Set false to drive it yourself. */
  autoUpload?: boolean
  /** Auto-confirm `open-dialog` (default true). Set false to drive it yourself. */
  autoDialog?: boolean
  /** Base for the fake URLs the auto-upload returns (default "https://uploads.example/"). */
  uploadUrlBase?: string
  /** Test seam: provide a (mock) channel instead of `new MessageChannel()`. */
  createChannel?: () => { port1: MessagePort; port2: MessagePort }
  /** Test seam: how to hand `port2` to the iframe. Default posts it on `window`. */
  transferPort?: (port: MessagePort) => void
}

/** Options the Playwright wrapper can forward across `page.evaluate` (must be serializable). */
export type SerializableHostEmulatorOptions = Pick<
  HostEmulatorOptions,
  "autoUpload" | "autoDialog" | "uploadUrlBase"
>

/** The API the emulator installs on `window.__host`. */
export interface HostApi {
  /** Push a `set-state` for `viewType` with the given view `data` (merging any envelope overrides). */
  setState: (viewType: string, data: unknown, overrides?: Record<string, unknown>) => void
  /** Push a fully-formed `set-state` envelope (e.g. from the state builders). */
  setStateRaw: (state: Record<string, unknown>) => void
  /** Tell the iframe the UI language (BCP 47 code). */
  setLanguage: (language: string) => void
  /** Reply to a `file-upload` (use with `autoUpload: false`), echoing its `requestId`. */
  sendUploadResult: (requestId: string, result: UploadResultInput) => void
  /** Reply to an `open-dialog` (use with `autoDialog: false`), echoing its `requestId`. */
  respondToDialog: (requestId: string, confirmed: boolean) => void
  /** Answer a `request-repository-exercises` (TMC-style plugins). */
  sendRepositoryExercises: (repositoryExercises: unknown[]) => void
  /** Deliver `test-results` (TMC-style plugins). */
  sendTestResults: (testResult: unknown) => void
  /** The most recent message of `type`, or null. Survives `height-changed` spam. */
  last: (type: string) => RecordedMessage | null
  /** Full message history, optionally filtered by `type`. */
  messages: (type?: string) => RecordedMessage[]
  /** Resolve with a matching message (already received or the next to arrive), else reject on timeout. */
  waitFor: (
    type: string,
    predicate?: (message: RecordedMessage) => boolean,
    timeoutMs?: number,
  ) => Promise<RecordedMessage>
  /** Serialization-safe snapshots of completed `file-upload` messages, in receive order. */
  fileUploads: () => FileUploadSnapshot[]
  /** Number of `file-upload` messages received, including snapshots whose hash is still pending. */
  fileUploadCount: () => number
  /** Resolve with a matching completed upload snapshot, else reject on timeout. */
  waitForFileUpload: (
    predicate?: (upload: FileUploadSnapshot) => boolean,
    timeoutMs?: number,
  ) => Promise<FileUploadSnapshot>
  /** Clear the recorded history and upload snapshots. */
  reset: () => void
}

declare global {
  interface Window {
    __host: HostApi
  }
}

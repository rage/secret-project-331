/** Messages between the CMS server and the block validator worker. */
export type ValidatorRequest = { kind: "validate"; body: unknown } | { kind: "block-schemas" }

export type WorkerRequest = ValidatorRequest & { id: number }

/** An answer to a validator request, as the agent validator routes send it. */
export interface ValidatorResponse {
  status: number
  body: unknown
}

export type WorkerReply = ValidatorResponse & { id: number }

export interface WorkerReady {
  kind: "ready"
}

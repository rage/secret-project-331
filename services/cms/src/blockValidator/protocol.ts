/** Messages between the CMS server and the block validator worker. */
export type WorkerRequest =
  | { id: number; kind: "validate"; body: unknown }
  | { id: number; kind: "block-schemas" }

export interface WorkerReply {
  id: number
  status: number
  body: unknown
}

export interface WorkerReady {
  kind: "ready"
}

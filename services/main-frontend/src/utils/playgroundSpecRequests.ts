import { v4 } from "uuid"

import type { SpecRequest } from "@/utils/playgroundSchemas"

/** Read a response body as JSON, falling back to the raw text when a service answers with prose. */
export async function readJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

interface DerivedSpecRequest {
  endpointUrl: string
  privateSpec: unknown
  uploadUrl: string
  /** From the service's own service info; decides which response shape is expected. */
  declaresSpecFiles: boolean
  /** Names the spec in the errors this throws, e.g. "public spec". */
  specDescription: string
}

/**
 * Derive a spec the way the host does, including unwrapping the `{ spec, files }` envelope a
 * service that declares `declares_spec_files` answers with.
 *
 * Both spec endpoints go through here so the Playground cannot preview a shape no student would be
 * sent. Throws on a failed request and on a response that does not match what the service declared.
 */
export async function fetchDerivedSpec(request: DerivedSpecRequest): Promise<unknown> {
  const payload: SpecRequest = {
    request_id: v4(),
    private_spec: request.privateSpec,
    upload_url: request.uploadUrl,
  }
  const res = await fetch(request.endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Failed to load ${request.specDescription} (${res.status})`)
  }
  const body = await readJsonResponse(res)
  if (!request.declaresSpecFiles) {
    return body
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("spec" in body) ||
    !("files" in body) ||
    !Array.isArray(body.files) ||
    body.files.some((fileId) => typeof fileId !== "string")
  ) {
    throw new Error(
      `This service declares spec files, so its ${request.specDescription} response has to be ` +
        `{ "spec": ..., "files": ["<file id>", ...] } rather than the bare spec.`,
    )
  }
  return body.spec
}

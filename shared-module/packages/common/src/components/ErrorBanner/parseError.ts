import { normalizeErrorForDisplay } from "../../errors/normalizeErrorForDisplay"

export interface ParsedError {
  title: string
  message?: string
  sourceData?: unknown
  linkBlockId?: string
  status?: number | null
  messageKey?: string | null
  type?: string | null
  requestId?: string | null
  code?: string | null
  issues?: Array<{ path?: string; code?: string; message: string }>
  retryAfterSeconds?: number | null
}

/**
 * Parses an unknown error value into a structure suitable for rendering.
 */
export function parseError(error: unknown, defaultTitle: string): ParsedError {
  const normalized = normalizeErrorForDisplay(error)
  return {
    title: normalized.title || defaultTitle,
    message: normalized.message ?? undefined,
    sourceData: normalized.technicalDetails ?? undefined,
    linkBlockId: normalized.blockId ?? undefined,
    status: normalized.status,
    messageKey: normalized.messageKey,
    type: normalized.type,
    requestId: normalized.requestId,
    code: normalized.code,
    issues: normalized.issues,
    retryAfterSeconds: normalized.retryAfterSeconds,
  }
}

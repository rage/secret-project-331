import type { TFunction } from "i18next"

import { normalizeErrorForDisplay } from "../../errors/normalizeErrorForDisplay"
import type { ErrorViewTechnicalDetails } from "../../errors/normalizeErrorForDisplay"

export interface ParsedError {
  title: string
  message?: string | undefined
  sourceData?: unknown
  technicalDetails?: ErrorViewTechnicalDetails | undefined
  linkBlockId?: string | undefined
  status?: number | null
  messageKey?: string | null
  type?: string | null
  requestId?: string | null
  code?: string | null
  issues?: { path?: string | undefined; code?: string | undefined; message: string }[]
  retryAfterSeconds?: number | null
}

/**
 * Parses an unknown error value into a structure suitable for rendering.
 */
export function parseError(error: unknown, defaultTitle: string, t: TFunction): ParsedError {
  const normalized = normalizeErrorForDisplay(error, t)
  const technicalDetails = normalized.technicalDetails ?? undefined
  return {
    title: normalized.title || defaultTitle,
    message: normalized.message ?? undefined,
    sourceData: technicalDetails?.detail ?? technicalDetails?.raw ?? undefined,
    technicalDetails,
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

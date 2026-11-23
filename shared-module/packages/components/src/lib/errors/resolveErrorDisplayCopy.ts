import type { TFunction } from "i18next"

import type { ErrorViewModel } from "./normalizeErrorForDisplay"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export interface ResolvedErrorDisplayCopy {
  title: string
  message: string | null
}

interface NormalizedMessageKey {
  key: string
  translationVariables?: Record<string, unknown> | undefined
  databaseConstraint?: string
}

function normalizeMessageKey(value: unknown): NormalizedMessageKey | null {
  if (typeof value === "string") {
    return value ? { key: value } : null
  }

  if (!isRecord(value)) {
    return null
  }

  if ("database_constraint" in value) {
    const databaseConstraint = value.database_constraint

    if (isRecord(databaseConstraint) && typeof databaseConstraint.constraint === "string") {
      return {
        key: databaseConstraint.constraint,
        databaseConstraint: databaseConstraint.constraint,
      }
    }

    return null
  }

  const [key, variables] = Object.entries(value)[0] ?? []

  if (!key) {
    return null
  }

  return {
    key,
    translationVariables: isRecord(variables) ? variables : undefined,
  }
}

function translateMessageKey(
  t: TFunction<"errors">,
  messageKey: NormalizedMessageKey,
  type: "title" | "message",
  defaultValue: string,
): string {
  const namespace = messageKey.databaseConstraint
    ? "database-constraint-error"
    : "error-message-key"

  const key = messageKey.databaseConstraint ? messageKey.databaseConstraint : messageKey.key

  return t(`${namespace}.${key}.${type}`, {
    defaultValue,
    replace: messageKey.translationVariables,
  })
}

function resolveIssueCodeMessage(error: ErrorViewModel, t: TFunction<"errors">): string | null {
  const firstIssueCode = error.issues.find((issue) => typeof issue.code === "string")?.code
  if (!firstIssueCode) {
    return null
  }
  const localized = t(`error-issue-code.${firstIssueCode}.message`, { defaultValue: "" })
  return localized.trim() === "" ? null : localized
}

/**
 * Resolves localized user-facing title and message from normalized error data.
 */
export function resolveErrorDisplayCopy(
  error: ErrorViewModel,
  t: TFunction<"errors">,
): ResolvedErrorDisplayCopy {
  const messageKey = normalizeMessageKey(error.messageKey)

  const title = messageKey ? translateMessageKey(t, messageKey, "title", error.title) : error.title

  const issueCodeMessage = resolveIssueCodeMessage(error, t)

  if (issueCodeMessage) {
    return {
      title,
      message: issueCodeMessage,
    }
  }

  if (messageKey) {
    const localizedMessage = translateMessageKey(t, messageKey, "message", "")

    if (localizedMessage.trim()) {
      return {
        title,
        message: localizedMessage,
      }
    }
  }

  return {
    title,
    message: error.message,
  }
}

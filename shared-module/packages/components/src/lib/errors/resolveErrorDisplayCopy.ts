import type { TFunction } from "i18next"

import type { ErrorViewModel } from "./normalizeErrorForDisplay"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export interface ResolvedErrorDisplayCopy {
  title: string
  message: string | null
}

function resolveIssueCodeMessage(error: ErrorViewModel, t: TFunction<"errors">): string | null {
  const firstIssueCode = error.issues.find((issue) => typeof issue.code === "string")?.code
  if (!firstIssueCode) {
    return null
  }
  const localized = t(`error-issue-code.${firstIssueCode}.message`, { defaultValue: "" })
  return localized.trim() === "" ? null : localized
}

function stringifyMessageKey(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (isRecord(value)) {
    const key = Object.keys(value)[0]

    if (key) {
      return key
    }
  }
}

/**
 * Resolves localized user-facing title and message from normalized error data.
 */
export function resolveErrorDisplayCopy(
  error: ErrorViewModel,
  t: TFunction<"errors">,
): ResolvedErrorDisplayCopy {
  const errorIsDatabaseConstraint =
    isRecord(error.messageKey) && "database_constraint" in error.messageKey

  const localizedTitle = errorIsDatabaseConstraint
    ? t(`database-constraint-error.${error.messageKey.database_constraint.constraint}.title`)
    : error.messageKey
      ? t(`error-message-key.${stringifyMessageKey(error.messageKey)}.title`, {
          defaultValue: error.title,
        })
      : error.title

  const issueCodeMessage = resolveIssueCodeMessage(error, t)
  if (issueCodeMessage) {
    return {
      title: localizedTitle,
      message: issueCodeMessage,
    }
  }

  const variablesArray = isRecord(error.messageKey) ? Object.values(error.messageKey) : null

  const translationVariables =
    variablesArray?.length === 1 && isRecord(variablesArray[0]) ? variablesArray[0] : null

  if (error.messageKey) {
    const localizedMessage = errorIsDatabaseConstraint
      ? t(`database-constraint-error.${error.messageKey.database_constraint.constraint}.message`, {
          defaultValue: "",
          ...translationVariables,
        })
      : t(`error-message-key.${stringifyMessageKey(error.messageKey)}.message`, {
          defaultValue: "",
          ...translationVariables,
        })

    if (localizedMessage.trim() !== "") {
      return {
        title: localizedTitle,
        message: localizedMessage,
      }
    }
  }

  return {
    title: localizedTitle,
    message: error.message,
  }
}

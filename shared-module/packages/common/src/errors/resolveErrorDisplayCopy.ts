import type { TFunction } from "i18next"

import type { ErrorViewModel } from "./normalizeErrorForDisplay"

export interface ResolvedErrorDisplayCopy {
  title: string
  message: string | null
}

function resolveIssueCodeMessage(error: ErrorViewModel, t: TFunction): string | null {
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
  t: TFunction,
): ResolvedErrorDisplayCopy {
  const localizedTitle = error.messageKey
    ? t(`error-message-key.${error.messageKey}.title`, { defaultValue: error.title })
    : error.title

  const issueCodeMessage = resolveIssueCodeMessage(error, t)
  if (issueCodeMessage) {
    return {
      title: localizedTitle,
      message: issueCodeMessage,
    }
  }

  if (error.messageKey) {
    const localizedMessage = t(`error-message-key.${error.messageKey}.message`, {
      defaultValue: "",
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

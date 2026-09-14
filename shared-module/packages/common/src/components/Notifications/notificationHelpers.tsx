"use client"

import type { TFunction } from "i18next"
import { toast, type Toast } from "react-hot-toast"

import { normalizeErrorForDisplay } from "../../errors/normalizeErrorForDisplay"
import { resolveErrorDisplayCopy } from "../../errors/resolveErrorDisplayCopy"
import { omitUndefined } from "../../utils/nullability"
import ErrorNotification from "./Error"
import LoadingNotification from "./Loading"
import SuccessNotification from "./Success"

/** The message a toast should show for an error, resolved through the same display pipeline
 * `ErrorBanner` reads its copy from. */
export const errorNotificationMessage = (error: unknown, t: TFunction): string => {
  const copy = resolveErrorDisplayCopy(normalizeErrorForDisplay(error, t), t)
  return copy.message ?? copy.title
}

interface NotificationOptions {
  header?: string
  message?: string
  duration?: number
}

export const showSuccessNotification = ({
  header,
  message,
  duration = 5000,
}: NotificationOptions) => {
  return toast.custom(
    (t: Toast) => (
      <SuccessNotification
        {...omitUndefined({ header })}
        {...omitUndefined({ message })}
        toastId={t.id}
      />
    ),
    { duration },
  )
}

export const showErrorNotification = ({
  header,
  message,
  duration = 5000,
}: NotificationOptions) => {
  return toast.custom(
    (t: Toast) => (
      <ErrorNotification
        {...omitUndefined({ header })}
        {...omitUndefined({ message })}
        toastId={t.id}
      />
    ),
    { duration },
  )
}

export const showLoadingNotification = ({
  message,
  duration = 5000,
}: Omit<NotificationOptions, "header">) => {
  return toast.custom((_t: Toast) => <LoadingNotification {...omitUndefined({ message })} />, {
    duration,
  })
}

// Helper to remove a specific toast
export const removeNotification = (toastId: string) => {
  toast.remove(toastId)
}

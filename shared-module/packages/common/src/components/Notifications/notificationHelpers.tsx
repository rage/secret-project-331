import toast, { Toast } from "react-hot-toast"

import DeleteNotification from "./Delete"
import ErrorNotification from "./Error"
import LoadingNotification from "./Loading"
import SuccessNotification from "./Success"

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
    (t: Toast) => <SuccessNotification header={header} message={message} toastId={t.id} />,
    { duration },
  )
}

export const showErrorNotification = ({
  header,
  message,
  duration = 5000,
}: NotificationOptions) => {
  return toast.custom(
    (t: Toast) => <ErrorNotification header={header} message={message} toastId={t.id} />,
    { duration },
  )
}

export const showDeleteNotification = ({
  header,
  message,
  duration = 5000,
}: NotificationOptions) => {
  return toast.custom(
    (t: Toast) => <DeleteNotification header={header} message={message} toastId={t.id} />,
    { duration },
  )
}

export const showLoadingNotification = ({
  message,
  duration = 5000,
}: Omit<NotificationOptions, "header">) => {
  return toast.custom((_t: Toast) => <LoadingNotification message={message} />, {
    duration,
  })
}

// Helper to remove a specific toast
export const removeNotification = (toastId: string) => {
  toast.remove(toastId)
}

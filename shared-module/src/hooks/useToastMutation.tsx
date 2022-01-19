import toast, { ToastOptions } from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { MutationFunction, useMutation, UseMutationOptions, UseMutationResult } from "react-query"

import ErrorNotification from "../components/Notifications/Error"
import LoadingNotification from "../components/Notifications/Loading"
import SuccessNotification from "../components/Notifications/Success"

interface EnableNotifications {
  notify: true
  type: "POST" | "PUT" | "DELETE"
  dismissable?: boolean
  loadingText?: string
  successHeader?: string
  successMessage?: string
  errorHeader?: string
  errorMessage?: string
  toastOptions?: ToastOptions
}

interface DisableNotifications {
  notify: false
}

type NotificationOptions = EnableNotifications | DisableNotifications

export default function useToastMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(
  mutationFn: MutationFunction<TData, TVariables>,
  notificationOptions: NotificationOptions,
  mutationOptions?: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn">,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { t } = useTranslation()

  let toastId = ""
  const displaySuccessNotification = (
    notificationOptions: EnableNotifications,
    defaultMessage?: string,
  ) => {
    toast.custom(
      (toast) => {
        return (
          <SuccessNotification
            header={notificationOptions.successHeader}
            message={notificationOptions.successMessage ?? defaultMessage}
            {...(notificationOptions.dismissable ? { toastId: toast.id } : {})}
          />
        )
      },
      {
        ...notificationOptions.toastOptions,
        id: toastId,
      },
    )
  }

  const mutation = useMutation(mutationFn, {
    ...mutationOptions,
    onMutate: (variables: TVariables) => {
      if (notificationOptions.notify) {
        // Set toastId that is updated once operation is successful or erronous.
        toastId = toast.custom(<LoadingNotification message={notificationOptions.loadingText} />, {
          ...notificationOptions.toastOptions,
        })
      }
      if (mutationOptions?.onMutate) {
        mutationOptions.onMutate(variables)
      }
      return undefined
    },
    onSuccess: (data: TData, variables: TVariables, context: TContext) => {
      if (notificationOptions.notify) {
        switch (notificationOptions.type) {
          case "PUT":
            displaySuccessNotification(notificationOptions, t("edit-has-been-saved"))
            break
          case "POST":
            displaySuccessNotification(notificationOptions, t("added-successfully"))
            break
          case "DELETE":
            toast.custom(<div></div>)
            break
          default:
            displaySuccessNotification(notificationOptions)
        }
      }
      if (mutationOptions?.onSuccess) {
        return mutationOptions.onSuccess(data, variables, context)
      }
    },
    onError: (error: TError, variables: TVariables, context: TContext | undefined) => {
      if (notificationOptions.notify) {
        toast.custom(
          (toast) => {
            return (
              <ErrorNotification
                header={notificationOptions.errorHeader}
                message={notificationOptions.errorMessage}
                {...(notificationOptions.dismissable ? { toastId: toast.id } : {})}
              />
            )
          },
          { ...notificationOptions.toastOptions, id: toastId },
        )
      }
      if (mutationOptions?.onError) {
        return mutationOptions.onError(error, variables, context)
      }
    },
  })
  return mutation
}

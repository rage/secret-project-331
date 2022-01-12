import toast, { ToastOptions } from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { MutationFunction, useMutation, UseMutationOptions, UseMutationResult } from "react-query"

import ErrorNotification from "../components/Notifications/Error"
import SuccessNotification from "../components/Notifications/Success"

interface NotificationOptions {
  notify: boolean
  type?: "POST" | "PUT" | "DELETE"
  dismissable?: boolean
  loadingText?: string
  successHeader?: string
  successMessage?: string
  errorHeader?: string
  errorMessage?: string
  toastOptions?: ToastOptions
}

export default function useToastMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(
  mutationFn: MutationFunction<TData, TVariables>,
  options?: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn">,
  notificationOptions?: NotificationOptions,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { t } = useTranslation()
  const {
    notify,
    type,
    dismissable,
    loadingText,
    successHeader,
    successMessage,
    errorHeader,
    errorMessage,
    toastOptions,
  } = notificationOptions || {}

  let toastId = ""
  const displaySuccessNotification = (message?: string) => {
    toast.custom(
      (toast) => {
        return (
          <SuccessNotification
            header={successHeader}
            message={successMessage ?? message}
            {...(dismissable ? { toastId: toast.id } : {})}
          />
        )
      },
      {
        ...toastOptions,
        id: toastId,
      },
    )
  }

  const mutation = useMutation(mutationFn, {
    ...options,
    onMutate: (variables: TVariables) => {
      if (notify) {
        // Set toastId that is updated once operation is successful or erronous.
        toastId = toast.loading(loadingText ?? t("saving"), { ...toastOptions })
      }
      if (options?.onMutate) {
        options.onMutate(variables)
      }
      return undefined
    },
    onSuccess: (data: TData, variables: TVariables, context: TContext | undefined) => {
      if (notify) {
        switch (type) {
          case "PUT":
            displaySuccessNotification(t("edit-has-been-saved"))
            break
          case "POST":
            displaySuccessNotification(t("added-successfully"))
            break
          case "DELETE":
            toast.custom(<div></div>)
            break
          default:
            displaySuccessNotification()
        }
      }
      if (options?.onSuccess) {
        return options.onSuccess(data, variables, context)
      }
    },
    onError: (error: TError, variables: TVariables, context: TContext | undefined) => {
      if (notify) {
        toast.custom(
          (toast) => {
            return (
              <ErrorNotification
                header={errorHeader}
                message={errorMessage}
                {...(dismissable ? { toastId: toast.id } : {})}
              />
            )
          },
          { ...toastOptions, id: toastId },
        )
      }
      if (options?.onError) {
        return options.onError(error, variables, context)
      }
    },
  })
  return mutation
}

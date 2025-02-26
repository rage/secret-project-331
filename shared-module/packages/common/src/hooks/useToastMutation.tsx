import {
  MutationFunction,
  useMutation,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query"
import { AxiosError } from "axios"
import toast, { ToastOptions } from "react-hot-toast"

import {
  showDeleteNotification,
  showErrorNotification,
  showLoadingNotification,
  showSuccessNotification,
} from "../components/Notifications/notificationHelpers"

import useSetShowStuffInfinitelyInSystemTestScreenshots from "./useShowToastInfinitely"

interface EnableNotifications {
  notify: true
  method: "POST" | "PUT" | "DELETE"
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
  mutationOptions: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn"> = {},
): UseMutationResult<TData, TError, TVariables, TContext> {
  const showToastInfinitely = useSetShowStuffInfinitelyInSystemTestScreenshots()

  const mutation = useMutation({
    mutationFn,
    ...mutationOptions,
    onMutate: (variables: TVariables) => {
      if (notificationOptions.notify) {
        toast.remove()
        showLoadingNotification({
          message: notificationOptions.loadingText,
          duration: showToastInfinitely ? Infinity : notificationOptions.toastOptions?.duration,
        })
      }
      if (mutationOptions?.onMutate) {
        mutationOptions.onMutate(variables)
      }
      return undefined
    },
    onSuccess: (data: TData, variables: TVariables, context) => {
      if (notificationOptions.notify) {
        toast.remove()
        const options = {
          header: notificationOptions.successHeader,
          message: notificationOptions.successMessage,
          duration: showToastInfinitely ? Infinity : notificationOptions.toastOptions?.duration,
        }

        if (notificationOptions.method === "DELETE") {
          showDeleteNotification(options)
        } else {
          showSuccessNotification(options)
        }
      }
      if (mutationOptions?.onSuccess) {
        return mutationOptions.onSuccess(data, variables, context)
      }
    },
    onError: (error: TError, variables: TVariables, context) => {
      console.groupCollapsed(`Mutation resulted in an error.`)
      console.warn(`Error: ${error}`)
      console.warn(error)
      console.groupEnd()

      if (notificationOptions.notify) {
        // Remove old toasts
        toast.remove()
        let errorMessage = notificationOptions.errorMessage
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!errorMessage && (error as any)?.data?.message) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          errorMessage = (error as any).data.message
        }
        if (!errorMessage && (error as AxiosError).isAxiosError) {
          const axiosError = error as AxiosError
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          errorMessage = (axiosError.response?.data as any)?.message
        } else if (!errorMessage || errorMessage === "") {
          errorMessage = (error as Error).message
        }

        showErrorNotification({
          header: notificationOptions.errorHeader,
          message: errorMessage,
          duration: showToastInfinitely ? Infinity : notificationOptions.toastOptions?.duration,
        })
      }
      if (mutationOptions?.onError) {
        return mutationOptions.onError(error, variables, context)
      }
    },
  })
  return mutation
}

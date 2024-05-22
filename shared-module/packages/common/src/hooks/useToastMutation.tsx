/* eslint-disable i18next/no-literal-string */
import {
  MutationFunction,
  // eslint-disable-next-line no-restricted-imports
  useMutation,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query"
import { AxiosError } from "axios"
import toast, { ToastOptions } from "react-hot-toast"

import DeleteNotification from "../components/Notifications/Delete"
import ErrorNotification from "../components/Notifications/Error"
import LoadingNotification from "../components/Notifications/Loading"
import SuccessNotification from "../components/Notifications/Success"

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
  let toastId = ""
  const displaySuccessNotification = (notificationOptions: EnableNotifications) => {
    toast.custom(
      (toast) => {
        return (
          <SuccessNotification
            header={notificationOptions.successHeader}
            message={notificationOptions.successMessage}
            {...(notificationOptions.dismissable ? { toastId: toast.id } : {})}
          />
        )
      },
      {
        ...notificationOptions.toastOptions,
        duration: showToastInfinitely ? Infinity : notificationOptions.toastOptions?.duration,
        id: toastId,
      },
    )
  }

  const mutation = useMutation({
    mutationFn,
    ...mutationOptions,
    onMutate: (variables: TVariables) => {
      if (notificationOptions.notify) {
        // Remove old toasts
        toast.remove()
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
    onSuccess: (data: TData, variables: TVariables, context) => {
      if (notificationOptions.notify) {
        // Remove old toasts
        toast.remove()
        switch (notificationOptions.method) {
          case "PUT":
            displaySuccessNotification(notificationOptions)
            break
          case "POST":
            displaySuccessNotification(notificationOptions)
            break
          case "DELETE":
            toast.custom(
              <DeleteNotification
                header={notificationOptions.successHeader}
                message={notificationOptions.successMessage}
                {...(notificationOptions.dismissable ? { id: toastId } : {})}
              />,
              {
                ...notificationOptions.toastOptions,
                id: toastId,
              },
            )
            break
          default:
            displaySuccessNotification(notificationOptions)
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
        toast.custom(
          (toast) => {
            return (
              <ErrorNotification
                header={notificationOptions.errorHeader}
                message={errorMessage}
                {...(notificationOptions.dismissable ? { toastId: toast.id } : {})}
              />
            )
          },
          {
            ...notificationOptions.toastOptions,
            id: toastId,
            duration: showToastInfinitely ? Infinity : notificationOptions.toastOptions?.duration,
          },
        )
      }
      if (mutationOptions?.onError) {
        return mutationOptions.onError(error, variables, context)
      }
    },
  })
  return mutation
}

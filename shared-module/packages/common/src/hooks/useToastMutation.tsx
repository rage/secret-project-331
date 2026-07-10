"use client"

import type {
  MutationFunction,
  MutationFunctionContext,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query"
import { useMutation } from "@tanstack/react-query"
import { BellXmark } from "@vectopus/atlas-icons-react"
import type { ReactNode } from "react"
import type { Toast, ToastOptions } from "react-hot-toast"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

import ErrorNotification from "../components/Notifications/Error"
import LoadingNotification from "../components/Notifications/Loading"
import SuccessNotification from "../components/Notifications/Success"
import { isAppApiError } from "../errors/AppApiError"
import { normalizeErrorForDisplay } from "../errors/normalizeErrorForDisplay"
import { resolveErrorDisplayCopy } from "../errors/resolveErrorDisplayCopy"
import { baseTheme } from "../styles"

import useSetShowStuffInfinitelyInSystemTestScreenshots from "./useShowToastInfinitely"

interface EnableNotifications {
  notify: true
  method: "POST" | "PUT" | "PATCH" | "DELETE"
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

interface SuccessNotificationDisplayOptions {
  header?: string
  message?: string
  icon?: ReactNode
  closeHoverBackgroundColor?: string
  deleteVariant?: boolean
}

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
  const { t } = useTranslation()
  const showToastInfinitely = useSetShowStuffInfinitelyInSystemTestScreenshots()
  let toastId = ""
  /** Shows a success toast with method-specific defaults and optional visual overrides. */
  const displaySuccessNotification = (
    notificationOptions: EnableNotifications,
    options: SuccessNotificationDisplayOptions,
  ) => {
    toast.custom(
      (toast: Toast) => {
        return (
          <SuccessNotification
            header={options.header}
            message={options.message}
            {...(notificationOptions.dismissable ? { toastId: toast.id } : {})}
            icon={options.icon}
            closeHoverBackgroundColor={options.closeHoverBackgroundColor}
            deleteVariant={options.deleteVariant}
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
    onMutate: (variables: TVariables, context: MutationFunctionContext) => {
      if (notificationOptions.notify) {
        // Remove old toasts
        toast.remove()
        // Set toastId that is updated once operation is successful or erronous.
        toastId = toast.custom(<LoadingNotification message={notificationOptions.loadingText} />, {
          ...notificationOptions.toastOptions,
        })
      }
      if (mutationOptions?.onMutate) {
        return mutationOptions.onMutate(variables, context)
      }
      return undefined as TContext
    },
    onSuccess: (data: TData, variables: TVariables, context, meta) => {
      if (notificationOptions.notify) {
        // Remove old toasts
        toast.remove()
        const isDeleteMethod = notificationOptions.method === "DELETE"
        const successDisplayOptions: SuccessNotificationDisplayOptions = {
          header: notificationOptions.successHeader,
          message: notificationOptions.successMessage,
          deleteVariant: isDeleteMethod,
          ...(isDeleteMethod
            ? {
                icon: <BellXmark color={baseTheme.colors.red[700]} size={20} />,
                closeHoverBackgroundColor: baseTheme.colors.gray[100],
              }
            : {}),
        }
        switch (notificationOptions.method) {
          case "PUT":
            displaySuccessNotification(notificationOptions, successDisplayOptions)
            break
          case "PATCH":
            displaySuccessNotification(notificationOptions, successDisplayOptions)
            break
          case "POST":
            displaySuccessNotification(notificationOptions, successDisplayOptions)
            break
          case "DELETE":
            displaySuccessNotification(notificationOptions, successDisplayOptions)
            break
          default:
            displaySuccessNotification(notificationOptions, successDisplayOptions)
        }
      }
      if (mutationOptions?.onSuccess) {
        mutationOptions.onSuccess(data, variables, context, meta)
      }
    },
    onError: (error: TError, variables: TVariables, context, meta) => {
      console.groupCollapsed(`Mutation resulted in an error.`)
      console.warn(`Error: ${error}`)
      console.warn(error)
      console.groupEnd()
      if (notificationOptions.notify) {
        // Remove old toasts
        toast.remove()
        let errorMessage = notificationOptions.errorMessage
        if (!errorMessage) {
          const view = normalizeErrorForDisplay(error, t)
          const localizedCopy = resolveErrorDisplayCopy(view, t)
          errorMessage = localizedCopy.message ?? localizedCopy.title
        }
        if (!errorMessage && isAppApiError(error)) {
          errorMessage = error.userMessage ?? error.message
        }
        if (!errorMessage || errorMessage === "") {
          errorMessage = (error as Error).message
        }
        toast.custom(
          (toast: Toast) => {
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
        mutationOptions.onError(error, variables, context, meta)
      }
    },
  })
  return mutation
}

"use client"

import { UseMutationOptions, UseMutationResult } from "@tanstack/react-query"

import useToastMutation from "./useToastMutation"

type NotificationOptions = Parameters<typeof useToastMutation>[1]

export default function useToastMutationOptions<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(
  baseOptions: UseMutationOptions<TData, TError, TVariables, TContext>,
  notificationOptions: NotificationOptions,
  mutationOptions: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn"> = {},
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { mutationFn, ...baseMutationOptions } = baseOptions

  if (!mutationFn) {
    throw new Error("useToastMutationOptions requires a mutationFn")
  }

  return useToastMutation(mutationFn, notificationOptions, {
    ...baseMutationOptions,
    ...mutationOptions,
    onError: async (error, variables, context, meta) => {
      await baseMutationOptions.onError?.(error, variables, context, meta)
      await mutationOptions.onError?.(error, variables, context, meta)
    },
    onMutate: async (variables, context) => {
      const baseResult = await baseMutationOptions.onMutate?.(variables, context)
      const overrideResult = await mutationOptions.onMutate?.(variables, context)

      return (overrideResult ?? baseResult) as TContext
    },
    onSettled: async (data, error, variables, context, meta) => {
      await baseMutationOptions.onSettled?.(data, error, variables, context, meta)
      await mutationOptions.onSettled?.(data, error, variables, context, meta)
    },
    onSuccess: async (data, variables, context, meta) => {
      await baseMutationOptions.onSuccess?.(data, variables, context, meta)
      await mutationOptions.onSuccess?.(data, variables, context, meta)
    },
  })
}

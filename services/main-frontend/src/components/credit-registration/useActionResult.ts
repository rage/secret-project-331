"use client"

import type { MutationFunction, UseMutationResult } from "@tanstack/react-query"
import { useState } from "react"

import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

/** Bridges a fire-and-forget admin/teacher action button to the outcome banner rendered beside it. */
export function useActionResult<TData, TVariables = void, TError = unknown>(
  mutationFn: MutationFunction<TData, TVariables>,
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>,
): {
  result: TData | null
  setResult: (result: TData | null) => void
  mutation: UseMutationResult<TData, TError, TVariables>
} {
  const [result, setResult] = useState<TData | null>(null)
  const mutation = useToastMutation<TData, TError, TVariables>(
    mutationFn,
    { notify: false },
    {
      onSuccess: async (data, variables) => {
        setResult(data)
        await onSuccess?.(data, variables)
      },
    },
  )
  return { result, setResult, mutation }
}

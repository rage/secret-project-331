import { UseQueryOptions } from "@tanstack/react-query"

export type HookQueryOptions<TData = unknown> = Omit<
  UseQueryOptions<TData, Error, TData>,
  "queryKey" | "queryFn"
>

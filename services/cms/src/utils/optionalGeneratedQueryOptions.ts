import { skipToken } from "@tanstack/react-query"

type GeneratedQueryKey = [
  {
    _id: string
    _infinite?: boolean
    baseUrl?: string
    body?: unknown
    headers?: unknown
    path?: unknown
    query?: unknown
    tags?: readonly string[]
  },
]

interface OptionalGeneratedQueryOptionsConfig<
  TValue,
  TReadyValue extends TValue,
  TOptions extends { queryKey: unknown },
> {
  build: (value: TReadyValue) => TOptions
  enabled?: boolean
  isReady?: (value: TValue | null | undefined) => value is TReadyValue
  value: TValue | null | undefined
}

const DISABLED_GENERATED_QUERY_KEY: GeneratedQueryKey = [
  { _id: "__optionalGeneratedQueryDisabled__" },
]

const isNonNullish = <TValue>(value: TValue | null | undefined): value is NonNullable<TValue> =>
  value !== null && value !== undefined

/** Builds generated query options that disable safely until required params are ready. */
export const optionalGeneratedQueryOptions = <
  TValue,
  TOptions extends { queryKey: unknown },
  TReadyValue extends TValue = NonNullable<TValue>,
>({
  build,
  enabled = true,
  isReady = isNonNullish as (value: TValue | null | undefined) => value is TReadyValue,
  value,
}: OptionalGeneratedQueryOptionsConfig<TValue, TReadyValue, TOptions>): TOptions => {
  if (!isReady(value)) {
    return {
      enabled: false,
      queryFn: skipToken,
      queryKey: DISABLED_GENERATED_QUERY_KEY,
    } as unknown as TOptions
  }

  const options = build(value)

  if (enabled) {
    return options
  }

  return {
    ...options,
    enabled: false,
  } as TOptions
}

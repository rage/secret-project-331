import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react"

import useDebouncedValue from "./useDebouncedValue"

export interface UseUrlSyncedDebouncedQueryOptions {
  paramName: string
  delayMs: number
}

export interface UseUrlSyncedDebouncedQueryResult {
  inputValue: string
  setInputValue: Dispatch<SetStateAction<string>>
  queryValue: string
  runImmediate: () => void
}

/** Owns debounced input and URL-backed query state for a single search param. */
const useUrlSyncedDebouncedQuery = ({
  paramName,
  delayMs,
}: UseUrlSyncedDebouncedQueryOptions): UseUrlSyncedDebouncedQueryResult => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlInputValue = searchParams.get(paramName) ?? ""
  const urlQueryValue = urlInputValue.trim()
  const previousUrlInputValueRef = useRef({ paramName, value: urlInputValue })
  const urlInputValueChanged =
    previousUrlInputValueRef.current.paramName !== paramName ||
    previousUrlInputValueRef.current.value !== urlInputValue

  const [inputValue, setInputValue] = useState(urlInputValue)
  const [queryValue, setQueryValue] = useState(urlQueryValue)

  const trimmedInputValue = inputValue.trim()
  const debouncedInputValue = useDebouncedValue(trimmedInputValue, delayMs)

  useEffect(() => {
    if (!urlInputValueChanged) {
      return
    }
    previousUrlInputValueRef.current = { paramName, value: urlInputValue }
    setInputValue(urlInputValue)
    setQueryValue(urlQueryValue)
  }, [paramName, urlInputValue, urlInputValueChanged, urlQueryValue])

  useEffect(() => {
    if (urlInputValueChanged) {
      return
    }
    if (debouncedInputValue !== trimmedInputValue) {
      return
    }
    if (debouncedInputValue !== queryValue) {
      setQueryValue(debouncedInputValue)
    }
  }, [debouncedInputValue, queryValue, trimmedInputValue, urlInputValueChanged])

  useEffect(() => {
    if (urlInputValueChanged) {
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    if (queryValue === "") {
      params.delete(paramName)
    } else {
      params.set(paramName, queryValue)
    }
    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) {
      return
    }
    const newUrl = `${pathname}${nextQuery ? `?${nextQuery}` : ""}`
    router.replace(newUrl)
  }, [paramName, pathname, queryValue, router, searchParams, urlInputValueChanged])

  /** Applies the current trimmed input as the executed query without waiting for debounce. */
  const runImmediate = useCallback(() => {
    if (trimmedInputValue === queryValue) {
      return
    }
    setQueryValue(trimmedInputValue)
  }, [queryValue, trimmedInputValue])

  return { inputValue, setInputValue, queryValue, runImmediate }
}

export default useUrlSyncedDebouncedQuery

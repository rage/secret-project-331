import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"

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
  isPending: boolean
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
  const pendingUrlInputValueRef = useRef<{ paramName: string; value: string } | null>(null)
  const urlInputValueChanged =
    previousUrlInputValueRef.current.paramName !== paramName ||
    previousUrlInputValueRef.current.value !== urlInputValue

  const [inputValue, setInputValue] = useState(urlInputValue)
  const [queryValue, setQueryValue] = useState(urlQueryValue)
  // Drives `isPending` for the debounced-typing path so the search spinner shows while it commits.
  const [isPending, startQueryTransition] = useTransition()

  const trimmedInputValue = inputValue.trim()
  const debouncedInputValue = useDebouncedValue(trimmedInputValue, delayMs)

  useEffect(() => {
    if (!urlInputValueChanged) {
      return
    }

    const pending =
      pendingUrlInputValueRef.current?.paramName === paramName &&
      pendingUrlInputValueRef.current.value === urlInputValue

    previousUrlInputValueRef.current = { paramName, value: urlInputValue }
    setQueryValue(urlQueryValue)

    if (pending) {
      pendingUrlInputValueRef.current = null
      return
    }

    pendingUrlInputValueRef.current = null
    setInputValue(urlInputValue)
  }, [paramName, urlInputValue, urlInputValueChanged, urlQueryValue])

  useEffect(() => {
    if (urlInputValueChanged) {
      return
    }
    if (debouncedInputValue !== trimmedInputValue) {
      return
    }
    if (debouncedInputValue !== queryValue) {
      startQueryTransition(() => {
        setQueryValue(debouncedInputValue)
      })
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
    pendingUrlInputValueRef.current = { paramName, value: queryValue }
    router.replace(newUrl)
  }, [paramName, pathname, queryValue, router, searchParams, urlInputValueChanged])

  /**
   * Applies the current trimmed input as the query without waiting for the debounce. Committed urgently
   * (not in a transition) so Enter runs the search promptly and is never deferred behind other updates.
   */
  const runImmediate = useCallback(() => {
    if (trimmedInputValue === queryValue) {
      return
    }
    setQueryValue(trimmedInputValue)
  }, [queryValue, trimmedInputValue])

  return { inputValue, setInputValue, queryValue, runImmediate, isPending }
}

export default useUrlSyncedDebouncedQuery

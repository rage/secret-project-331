"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

// Backend also enforces this
const MAX_LIMIT = 10_000

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 100

export interface PaginationInfo {
  page: number
  setPage: (newValue: number) => void
  limit: number
  setLimit: (newValue: number) => void
}

function usePaginationInfo(defaultLimit: number = DEFAULT_LIMIT): PaginationInfo {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialPage = useMemo(() => {
    let parsedPage: number
    const pageParam = searchParams?.get("page")
    if (pageParam) {
      // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt parsing is intentional; Number() would change behavior
      parsedPage = parseInt(pageParam, 10)
    } else {
      parsedPage = DEFAULT_PAGE
    }
    if (isNaN(parsedPage)) {
      return DEFAULT_PAGE
    }
    return parsedPage
  }, [searchParams])
  const initialLimit = useMemo(() => {
    let parsedLimit: number
    const limitParam = searchParams?.get("limit")
    if (limitParam) {
      // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt parsing is intentional; Number() would change behavior
      parsedLimit = parseInt(limitParam, 10)
    } else {
      parsedLimit = defaultLimit
    }
    if (isNaN(parsedLimit)) {
      return defaultLimit
    }
    return parsedLimit
  }, [searchParams, defaultLimit])

  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  return {
    page: Math.max(1, page),
    setPage: (newValue: number) => {
      const currentParams = new URLSearchParams(searchParams?.toString() || "")
      // oxlint-disable-next-line i18next/no-literal-string
      currentParams.set("page", newValue.toString())
      const newUrl = `${window.location.pathname}?${currentParams.toString()}`
      router.replace(newUrl)
      setPage(newValue)
    },
    limit: Math.max(1, Math.min(limit, MAX_LIMIT)),
    setLimit: (newValue: number) => {
      const currentParams = new URLSearchParams(searchParams?.toString() || "")
      // oxlint-disable-next-line i18next/no-literal-string
      currentParams.set("limit", newValue.toString())
      // oxlint-disable-next-line i18next/no-literal-string
      currentParams.set("page", "1")
      const newUrl = `${window.location.pathname}?${currentParams.toString()}`
      router.replace(newUrl)
      setLimit(newValue)
      setPage(1)
    },
  }
}

export default usePaginationInfo

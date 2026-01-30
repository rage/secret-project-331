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

function usePaginationInfo(): PaginationInfo {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialPage = useMemo(() => {
    let initialPage: number
    const pageParam = searchParams?.get("page")
    if (pageParam) {
      initialPage = parseInt(pageParam)
    } else {
      initialPage = DEFAULT_PAGE
    }
    if (isNaN(initialPage)) {
      return DEFAULT_PAGE
    }
    return initialPage
  }, [searchParams])
  const initialLimit = useMemo(() => {
    let initialLimit: number
    const limitParam = searchParams?.get("limit")
    if (limitParam) {
      initialLimit = parseInt(limitParam)
    } else {
      initialLimit = DEFAULT_LIMIT
    }
    if (isNaN(initialLimit)) {
      return DEFAULT_LIMIT
    }
    return initialLimit
  }, [searchParams])

  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  return {
    page: Math.max(1, page),
    setPage: (newValue: number) => {
      const currentParams = new URLSearchParams(searchParams?.toString() || "")
      // eslint-disable-next-line i18next/no-literal-string
      currentParams.set("page", newValue.toString())
      const newUrl = `${window.location.pathname}?${currentParams.toString()}`
      router.replace(newUrl)
      setPage(newValue)
    },
    limit: Math.max(1, Math.min(limit, MAX_LIMIT)),
    setLimit: (newValue: number) => {
      const currentParams = new URLSearchParams(searchParams?.toString() || "")
      // eslint-disable-next-line i18next/no-literal-string
      currentParams.set("limit", newValue.toString())
      // eslint-disable-next-line i18next/no-literal-string
      currentParams.set("page", "1")
      const newUrl = `${window.location.pathname}?${currentParams.toString()}`
      router.replace(newUrl)
      setLimit(newValue)
      setPage(1)
    },
  }
}

export default usePaginationInfo

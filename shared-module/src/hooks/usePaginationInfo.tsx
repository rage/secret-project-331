import { useRouter } from "next/router"
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

  const initialPage = useMemo(() => {
    let initialPage: number
    if (typeof router.query.page === "string") {
      initialPage = parseInt(router.query.page)
    } else {
      initialPage = DEFAULT_PAGE
    }
    if (isNaN(initialPage)) {
      return DEFAULT_PAGE
    }
    return initialPage
  }, [router.query.page])
  const initialLimit = useMemo(() => {
    let initialLimit: number
    if (typeof router.query.limit === "string") {
      initialLimit = parseInt(router.query.limit)
    } else {
      initialLimit = DEFAULT_LIMIT
    }
    if (isNaN(initialLimit)) {
      return DEFAULT_LIMIT
    }
    return initialLimit
  }, [router.query.limit])

  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  return {
    page: Math.max(1, page),
    setPage: (newValue: number) => {
      router.replace(
        {
          query: {
            ...router.query,
            page: newValue,
          },
        },
        undefined,
        { shallow: true },
      )
      setPage(newValue)
    },
    limit: Math.max(1, Math.min(limit, MAX_LIMIT)),
    setLimit: (newValue: number) => {
      router.replace(
        {
          query: {
            ...router.query,
            limit: newValue,
            page: 1,
          },
        },
        undefined,
        { shallow: true },
      )
      setLimit(newValue)
      setPage(1)
    },
  }
}

export default usePaginationInfo

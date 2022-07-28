import { Pagination } from "@mui/material"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import React, { useState } from "react"

import { fetchHistoryCountForPage, restorePage } from "../../../../../../services/backend/pages"
import { PageHistory } from "../../../../../../shared-module/bindings"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"

import HistoryPage from "./HistoryPage"

interface Props {
  pageId: string
  initialSelectedRevisionId: string | null
  onRestore: (ph: PageHistory) => Promise<void>
  onCompare: (ph: PageHistory) => void
}

const HistoryList: React.FC<React.PropsWithChildren<Props>> = ({
  pageId,
  initialSelectedRevisionId,
  onRestore,
  onCompare,
}) => {
  const router = useRouter()
  const query = router.query.page
  let initialPage
  if (typeof query === "string") {
    initialPage = parseInt(query)
    initialPage = initialPage && initialPage > 0 ? initialPage : 1
  } else {
    initialPage = 1
  }

  const perPage = 1
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    initialSelectedRevisionId,
  )

  const getPageHistoryCount = useQuery([`page-history-count-${pageId}`], () =>
    fetchHistoryCountForPage(pageId),
  )

  function compare(history: PageHistory) {
    setSelectedRevisionId(history.id)
    onCompare(history)
  }

  async function restore(history: PageHistory) {
    const newHistoryId = await restorePage(pageId, history.id)
    await onRestore(history)
    await getPageHistoryCount.refetch()
    changePage(1)
    setSelectedRevisionId(newHistoryId)
  }

  function changePage(newPage: number) {
    router.replace({ query: { ...router.query, page: newPage } }, undefined, { shallow: true })
    setCurrentPage(newPage)
  }

  return (
    <>
      {getPageHistoryCount.isError && (
        <ErrorBanner variant={"readOnly"} error={getPageHistoryCount.error} />
      )}
      {getPageHistoryCount.isLoading && <Spinner variant={"medium"} />}
      {getPageHistoryCount.isSuccess && (
        <>
          <HistoryPage
            pageId={pageId}
            page={currentPage}
            limit={perPage}
            selectedRevisionId={selectedRevisionId}
            onCompare={compare}
            onRestore={restore}
          />
          <Pagination
            count={getPageHistoryCount.data / perPage}
            page={currentPage}
            onChange={(_, val) => changePage(val)}
          />
        </>
      )}
    </>
  )
}

export default HistoryList

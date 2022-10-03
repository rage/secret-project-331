import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"

import { fetchHistoryCountForPage, restorePage } from "../../../../../../services/backend/pages"
import { PageHistory } from "../../../../../../shared-module/bindings"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Pagination from "../../../../../../shared-module/components/Pagination"
import Spinner from "../../../../../../shared-module/components/Spinner"
import usePaginationInfo from "../../../../../../shared-module/hooks/usePaginationInfo"

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
  const paginationInfo = usePaginationInfo()

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
    paginationInfo.setPage(newPage)
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
            page={paginationInfo.page}
            limit={1}
            selectedRevisionId={selectedRevisionId}
            onCompare={compare}
            onRestore={restore}
          />
          <Pagination
            totalPages={getPageHistoryCount.data / 1}
            paginationInfo={{ ...paginationInfo, limit: 1 }}
            disableItemsPerPage
          />
        </>
      )}
    </>
  )
}

export default HistoryList

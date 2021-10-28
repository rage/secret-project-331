import { Pagination } from "@material-ui/core"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchHistoryCountForPage, restorePage } from "../../services/backend/pages"
import { PageHistory } from "../../shared-module/bindings"
import HistoryPage from "../HistoryPage"

interface Props {
  pageId: string
  initialSelectedRevisionId: string | null
  onRestore: (ph: PageHistory) => Promise<void>
  onCompare: (ph: PageHistory) => void
}

const HistoryList: React.FC<Props> = ({
  pageId,
  initialSelectedRevisionId,
  onRestore,
  onCompare,
}) => {
  const { t } = useTranslation()
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

  const { isLoading, error, data, refetch } = useQuery(`page-history-count-${pageId}`, () =>
    fetchHistoryCountForPage(pageId),
  )

  if (error) {
    return (
      <div>
        <h1>{t("error-title")}</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>{t("loading-text")}</div>
  }

  function compare(history: PageHistory) {
    setSelectedRevisionId(history.id)
    onCompare(history)
  }

  async function restore(history: PageHistory) {
    const newHistoryId = await restorePage(pageId, history.id)
    await onRestore(history)
    await refetch()
    changePage(1)
    setSelectedRevisionId(newHistoryId)
  }

  function changePage(newPage: number) {
    router.replace({ query: { ...router.query, page: newPage } }, undefined, { shallow: true })
    setCurrentPage(newPage)
  }

  return (
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
        count={data / perPage}
        page={currentPage}
        onChange={(_, val) => changePage(val)}
      />
    </>
  )
}

export default HistoryList

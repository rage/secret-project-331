"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import {
  getPageHistoryCountOptions,
  restorePageHistoryMutation as restorePageHistoryMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { PageHistory } from "@/generated/api/types.generated"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { Pagination, QueryResult } from "@/shared-module/components"

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
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()
  const [statusMessage, setStatusMessage] = useState("")
  // Restoring swaps in a new row, so focus is handed to its Restore button.
  const [focusRevisionId, setFocusRevisionId] = useState<string | null>(null)

  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    initialSelectedRevisionId,
  )

  const getPageHistoryCount = useQuery({
    ...getPageHistoryCountOptions({
      path: {
        page_id: pageId,
      },
    }),
  })
  const restorePageHistoryMutation = useMutation(restorePageHistoryMutationOptions())

  function compare(history: PageHistory) {
    setSelectedRevisionId(history.id)
    onCompare(history)
  }

  async function restore(history: PageHistory) {
    const newHistoryId = await restorePageHistoryMutation.mutateAsync({
      path: {
        page_id: pageId,
      },
      body: {
        history_id: history.id,
      },
    })
    await onRestore(history)
    await getPageHistoryCount.refetch()
    changePage(1)
    setFocusRevisionId(newHistoryId)
    setSelectedRevisionId(newHistoryId)
    setStatusMessage(t("page-restored"))
  }

  function changePage(newPage: number) {
    setFocusRevisionId(null)
    paginationInfo.setPage(newPage)
  }

  return (
    <QueryResult query={getPageHistoryCount}>
      {(pageHistoryCount) => (
        <>
          <VisuallyHidden>
            <div role="status">{statusMessage}</div>
          </VisuallyHidden>
          <HistoryPage
            pageId={pageId}
            page={paginationInfo.page}
            limit={1}
            selectedRevisionId={selectedRevisionId}
            onCompare={compare}
            onRestore={restore}
            focusRevisionId={focusRevisionId}
          />
          <Pagination
            totalPages={pageHistoryCount}
            page={paginationInfo.page}
            onPageChange={changePage}
            itemsPerPage={1}
          />
        </>
      )}
    </QueryResult>
  )
}

export default HistoryList

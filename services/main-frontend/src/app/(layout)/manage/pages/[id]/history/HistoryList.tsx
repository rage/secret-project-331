"use client"

import { announce } from "@react-aria/live-announcer"
import { useMutation, useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
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
    // oxlint-disable-next-line i18next/no-literal-string -- ARIA politeness level, not user copy
    announce(t("page-restored"), "polite")
  }

  function changePage(newPage: number) {
    setFocusRevisionId(null)
    paginationInfo.setPage(newPage)
  }

  return (
    <QueryResult query={getPageHistoryCount}>
      {(pageHistoryCount) => (
        <>
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

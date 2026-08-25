"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import React, { useState } from "react"

import {
  getPageHistoryCountOptions,
  restorePageHistoryMutation as restorePageHistoryMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { PageHistory } from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { QueryResult } from "@/shared-module/components"

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
    setSelectedRevisionId(newHistoryId)
  }

  function changePage(newPage: number) {
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
          />
          <Pagination
            totalPages={pageHistoryCount / 1}
            paginationInfo={{ ...paginationInfo, limit: 1 }}
            disableItemsPerPage
          />
        </>
      )}
    </QueryResult>
  )
}

export default HistoryList

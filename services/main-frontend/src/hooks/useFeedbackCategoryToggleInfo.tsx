"use client"

import { useToggleGroupState } from "@react-stately/toggle"
import { useEffect, useRef } from "react"
import { useId } from "react-aria"

import type { PaginationInfo } from "@/shared-module/common/hooks/usePaginationInfo"

const useFeedbackCategoryToggleInfo = (paginationInfo: PaginationInfo) => {
  const allFeedbackId = useId()
  const selectedCategory = useRef<string | undefined>(undefined)

  let toggleState = useToggleGroupState({
    // oxlint-disable-next-line i18next/no-literal-string
    selectionMode: "single",
    disallowEmptySelection: true,
    defaultSelectedKeys: new Set([allFeedbackId]),
  })
  let selected = toggleState.selectedKeys.keys().next().value?.toString()

  useEffect(() => {
    if (selectedCategory.current !== selected) {
      selectedCategory.current = selected
      paginationInfo.setPage(1)
    }
  }, [selected, paginationInfo])

  return { allFeedbackId, selectedCategory, toggleState }
}

export default useFeedbackCategoryToggleInfo

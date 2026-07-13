"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import HistoryList from "./HistoryList"

import { getPageHistoryOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { PageHistory } from "@/generated/api/types.generated"
import MonacoDiffEditor from "@/shared-module/common/components/monaco/MonacoDiffEditor"
import replaceUuidsWithPlaceholdersInText from "@/shared-module/common/utils/testing/replaceUuidsWithPlaceholders"
import { QueryResult } from "@/shared-module/components"

interface Props {
  pageId: string
}

const HistoryView: React.FC<React.PropsWithChildren<Props>> = ({ pageId }) => {
  const { t } = useTranslation()
  const [currentTitle, setCurrentTitle] = useState<string | null>(null)
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null)
  const [currentRevision, setCurrentRevision] = useState<string | null>(null)
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null)

  const getCurrentPageHistory = useQuery({
    ...getPageHistoryOptions({
      path: {
        page_id: pageId,
      },
      query: {
        page: 1,
        limit: 1,
      },
    }),
  })
  const currentPageHistory = getCurrentPageHistory.data?.[0]

  useEffect(() => {
    const callback = () => {
      if (currentRevision) {
        setCurrentRevision(replaceUuidsWithPlaceholdersInText(currentRevision))
      }
      if (selectedRevision) {
        setSelectedRevision(replaceUuidsWithPlaceholdersInText(selectedRevision))
      }
    }
    window.addEventListener("testing-mode-replace-content-for-screenshot", callback)
    return () => window.removeEventListener("testing-mode-replace-content-for-screenshot", callback)
  }, [currentRevision, selectedRevision])

  useEffect(() => {
    if (!currentPageHistory) {
      return
    }

    const initial = JSON.stringify(currentPageHistory.content, null, 2)
    setCurrentTitle(currentPageHistory.title)
    setSelectedTitle(currentPageHistory.title)
    setCurrentRevision(initial)
    setSelectedRevision(initial)
  }, [currentPageHistory])

  function onCompare(ph: PageHistory) {
    setSelectedTitle(ph.title)
    setSelectedRevision(JSON.stringify(ph.content, null, 2))
  }

  // oxlint-disable-next-line require-await -- kept async to satisfy HistoryList onRestore: (ph) => Promise<void> contract
  async function onRestore(ph: PageHistory) {
    setCurrentTitle(ph.title)
    setCurrentRevision(JSON.stringify(ph.content, null, 2))
  }

  return (
    <QueryResult
      query={getCurrentPageHistory}
      emptyFallback={<div>{t("error-could-not-find-edit-history-for-page")}</div>}
    >
      {(data) => {
        const pageHistory = data[0]
        return (
          <div>
            <p
              className={css`
                text-align: center;
              `}
            >
              {t("previous-title-current-title", {
                "current-title": currentTitle,
                "selected-title": selectedTitle,
              })}
            </p>
            <MonacoDiffEditor
              height="40vh"
              // oxlint-disable-next-line i18next/no-literal-string
              language="json"
              original={currentRevision || t("loading-text")}
              modified={selectedRevision || t("loading-text")}
              options={{ readOnly: true }}
            />
            <HistoryList
              pageId={pageId}
              initialSelectedRevisionId={pageHistory.id}
              onCompare={onCompare}
              onRestore={onRestore}
            />
          </div>
        )
      }}
    </QueryResult>
  )
}

export default HistoryView

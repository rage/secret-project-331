import { css } from "@emotion/css"
import { DiffEditor } from "@monaco-editor/react"
import React, { useEffect, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchHistoryForPage } from "../services/backend/pages"
import { PageHistory } from "../shared-module/bindings"
import replaceUuidsWithPlaceholdersInText from "../shared-module/utils/testing/replaceUuidsWithPlaceholders"

import HistoryList from "./lists/HistoryList"

interface Props {
  pageId: string
}

const HistoryView: React.FC<Props> = ({ pageId }) => {
  const { t } = useTranslation()
  const [currentTitle, setCurrentTitle] = useState<string | null>(null)
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null)
  const [currentRevision, setCurrentRevision] = useState<string | null>(null)
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null)

  const { isLoading, error, data } = useQuery(`page-history-current-${pageId}`, async () => {
    const history = await fetchHistoryForPage(pageId, 1, 1)
    if (history.length === 0) {
      // there is always at least one history entry corresponding to the current state of the page
      throw new Error(t("error-could-not-find-edit-history-for-page"))
    }
    const initial = JSON.stringify(history[0].content, null, 2)
    setCurrentTitle(history[0].title)
    setSelectedTitle(history[0].title)
    setCurrentRevision(initial)
    setSelectedRevision(initial)
    return history[0]
  })

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

  function onCompare(ph: PageHistory) {
    setSelectedTitle(ph.title)
    setSelectedRevision(JSON.stringify(ph.content, null, 2))
  }

  async function onRestore(ph: PageHistory) {
    setCurrentTitle(ph.title)
    setCurrentRevision(JSON.stringify(ph.content, null, 2))
  }

  return (
    <>
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
      <DiffEditor
        height="40vh"
        // eslint-disable-next-line i18next/no-literal-string
        language="json"
        original={currentRevision || t("loading-text")}
        modified={selectedRevision || t("loading-text")}
        options={{ readOnly: true }}
      />
      <HistoryList
        pageId={pageId}
        initialSelectedRevisionId={data.id}
        onCompare={onCompare}
        onRestore={onRestore}
      />
    </>
  )
}

export default HistoryView

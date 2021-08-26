import { css } from "@emotion/css"
import { DiffEditor } from "@monaco-editor/react"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useQuery } from "react-query"

import { fetchHistoryForPage, restorePage } from "../services/backend/pages"
import { PageHistory } from "../shared-module/bindings"

import HistoryList from "./lists/HistoryList"

interface Props {
  pageId: string
}

const HistoryView: React.FC<Props> = ({ pageId }) => {
  const [currentTitle, setCurrentTitle] = useState<string | null>(null)
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null)
  const [currentRevision, setCurrentRevision] = useState<string | null>(null)
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null)

  const { isLoading, error, data } = useQuery(`page-history-current-${pageId}`, async () => {
    const history = await fetchHistoryForPage(pageId, 1, 1)
    if (history.length === 0) {
      // there is always at least one history entry corresponding to the current state of the page
      throw new Error("Could not find any edit history for the page")
    }
    const initial = JSON.stringify(history[0].content, null, 2)
    setCurrentTitle(history[0].title)
    setSelectedTitle(history[0].title)
    setCurrentRevision(initial)
    setSelectedRevision(initial)
    return history[0]
  })

  if (error) {
    return (
      <div>
        <h1>Error</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>Loading page...</div>
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
        Previous: {currentTitle} | Current: {selectedTitle}
      </p>
      <DiffEditor
        height="40vh"
        language="json"
        original={currentRevision || "Loading..."}
        modified={selectedRevision || "Loading..."}
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

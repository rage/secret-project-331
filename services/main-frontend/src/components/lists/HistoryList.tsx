import { css } from "@emotion/css"
import { Collapse, IconButton } from "@material-ui/core"
import ExpandLessIcon from "@material-ui/icons/ExpandLess"
import ExpandMoreIcon from "@material-ui/icons/ExpandMore"
import diff from "fast-diff"
import React, { useState } from "react"
import { useQuery } from "react-query"

import { fetchHistoryForPage, restorePage } from "../../services/backend/pages"
import Button from "../../shared-module/components/Button"

interface Props {
  pageId: string
}

const HistoryList: React.FC<Props> = ({ pageId }) => {
  const [uncollapsed, setUncollapsed] = useState(new Set())
  const [historyDiff, setHistoryDiff] = useState(new Map())

  const { isLoading, error, data, refetch } = useQuery(`page-history-${pageId}`, () =>
    fetchHistoryForPage(pageId),
  )

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

  data.sort((a, b) => {
    if (a.created_at < b.created_at) {
      return 1
    } else if (a.created_at > b.created_at) {
      return -1
    } else {
      return 0
    }
  })

  async function restore(historyId) {
    await restorePage(pageId, historyId)
    await refetch()
  }

  function onClick(oldJson: string, newJson: string, historyId: string) {
    setUncollapsed((uc) => {
      const s = new Set(uc)
      if (s.has(historyId)) {
        s.delete(historyId)
      } else {
        s.add(historyId)
      }
      return s
    })
    setHistoryDiff((hd) => {
      const s = new Map(hd)
      if (!s.has(historyId)) {
        const diffs = diff(oldJson, newJson).map((entry) => {
          if (entry[0] === diff.INSERT) {
            return (
              <span
                className={css`
                  background-color: LightGreen;
                `}
              >
                {entry[1].toString()}
              </span>
            )
          } else if (entry[0] === diff.DELETE) {
            return (
              <span
                className={css`
                  background-color: LightPink;
                `}
              >
                {entry[1].toString()}
              </span>
            )
          } else {
            return <span>{entry[1].toString()}</span>
          }
        })
        s.set(historyId, diffs)
      }
      return s
    })
  }

  // there is always at least one history entry for the current page
  const current = JSON.stringify(data[0].content, null, 2)
  return (
    <>
      {data.map((h) => {
        const content = JSON.stringify(h.content, null, 2)
        return (
          <div key={h.id}>
            <hr />
            {h.id} ({h.created_at.toDateString()})
            <br />
            Content JSON:
            <IconButton onClick={() => onClick(current, content, h.id)}>
              {uncollapsed.has(h.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
            <Collapse in={uncollapsed.has(h.id)}>
              {historyDiff.has(h.id) ? (
                <pre
                  className={css`
                    word-break: break-all;
                    white-space: pre-wrap;
                  `}
                >
                  {historyDiff.get(h.id)}
                </pre>
              ) : (
                <div>Loading diff...</div>
              )}
            </Collapse>
            <br />
            {h.history_change_reason === "PageSaved" && `Edited by ${h.author_user_id}`}
            {h.history_change_reason === "HistoryRestored" &&
              `Restored from ${h.restored_from_id} by ${h.author_user_id}`}
            <br />
            <Button variant={"primary"} size={"medium"} onClick={() => restore(h.id)}>
              Restore
            </Button>
          </div>
        )
      })}
    </>
  )
}

export default HistoryList

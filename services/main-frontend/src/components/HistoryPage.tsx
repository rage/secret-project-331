import { css } from "@emotion/css"
import React from "react"
import { useQuery } from "react-query"

import { fetchHistoryForPage } from "../services/backend/pages"
import { PageHistory } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

interface Props {
  pageId: string
  page: number
  limit: number
  selectedRevisionId: string | null
  onCompare: (ph: PageHistory) => void
  onRestore: (ph: PageHistory) => void
}

const HistoryPage: React.FC<Props> = ({
  pageId,
  page,
  limit,
  selectedRevisionId,
  onCompare,
  onRestore,
}) => {
  const { isLoading, error, data } = useQuery(
    `page-history-${pageId}-${page}-${limit}`,
    async () => {
      const history = await fetchHistoryForPage(pageId, page, limit)
      if (history.length === 0) {
        console.error("Could not find any edit history for the page")
        throw new Error("Could not find any edit history for the page")
      }
      return history
    },
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

  return (
    <>
      {data.map((h) => {
        return (
          <div
            key={h.id}
            className={
              selectedRevisionId === h.id
                ? css`
                    background-color: LightBlue;
                  `
                : ""
            }
          >
            <hr />
            <div>
              {h.id} ({h.created_at.toDateString()})
            </div>
            <div>
              {h.history_change_reason === "PageSaved" &&
                `Edited by ${h.author_user_id} on ${h.created_at}`}
              {h.history_change_reason === "HistoryRestored" &&
                `Restored from ${h.restored_from_id} by ${h.author_user_id} on ${h.created_at}`}
            </div>
            <div>
              <Button variant={"primary"} size={"medium"} onClick={() => onCompare(h)}>
                Compare
              </Button>{" "}
              <Button variant={"primary"} size={"medium"} onClick={() => onRestore(h)}>
                Restore
              </Button>
            </div>
          </div>
        )
      })}
    </>
  )
}

export default HistoryPage

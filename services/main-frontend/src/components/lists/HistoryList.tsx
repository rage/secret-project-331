import { Collapse, IconButton } from "@material-ui/core"
import ExpandLessIcon from "@material-ui/icons/ExpandLess"
import ExpandMoreIcon from "@material-ui/icons/ExpandMore"
import React, { useState } from "react"
import { useQuery } from "react-query"

import { fetchHistoryForPage, restorePage } from "../../services/backend/pages"
import Button from "../../shared-module/components/Button"

interface Props {
  pageId: string
}

const HistoryList: React.FC<Props> = ({ pageId }) => {
  const [uncollapsed, setUncollapsed] = useState(new Set())

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

  return (
    <>
      {data.map((h) => (
        <div key={h.id}>
          <hr />
          {h.id} ({h.created_at.toDateString()})
          <br />
          Content JSON:
          <IconButton
            onClick={() =>
              setUncollapsed((uc) => {
                const s = new Set(uc)
                if (s.has(h.id)) {
                  s.delete(h.id)
                } else {
                  s.add(h.id)
                }
                return s
              })
            }
          >
            {uncollapsed.has(h.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
          <Collapse in={uncollapsed.has(h.id)}>
            {" "}
            <pre>{JSON.stringify(h.content, null, 2)}</pre>{" "}
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
      ))}
    </>
  )
}

export default HistoryList

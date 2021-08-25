import { Paper, Tab, Tabs } from "@material-ui/core"
import { useRouter } from "next/router"
import React, { useState } from "react"

import Layout from "../../../../components/Layout"
import FeedbackList from "../../../../components/lists/FeedbackList"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface FeedbackProps {
  query: SimplifiedUrlQuery<"id">
}

const FeedbackPage: React.FC<FeedbackProps> = ({ query }) => {
  const router = useRouter()

  const courseId = query.id

  let initialRead
  if (router.query.read) {
    initialRead = router.query.read === "true"
  } else {
    router.replace({ query: { ...router.query, read: false } }, undefined, { shallow: true })
    initialRead = false
  }
  const [read, setRead] = useState(initialRead)

  return (
    <Layout>
      <h1>Feedback</h1>
      <Paper square>
        <Tabs
          value={read}
          onChange={(_, value) => {
            router.replace({ query: { ...router.query, read: value } }, undefined, {
              shallow: true,
            })
            setRead(value)
          }}
        >
          <Tab label="Unread" value={false} />
          <Tab label="Read" value={true} />
        </Tabs>
      </Paper>
      <FeedbackList courseId={courseId} read={read} perPage={1} />
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(FeedbackPage)))

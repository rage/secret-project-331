import { Paper, Tab, Tabs } from "@material-ui/core"
import { useRouter } from "next/router"
import React, { useState } from "react"

import Layout from "../../../../components/Layout"
import EditProposalList from "../../../../components/lists/EditProposalList"
import FeedbackList from "../../../../components/lists/FeedbackList"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { wideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import basePath from "../../../../shared-module/utils/base-path"
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

  let initialView: "feedback" | "fix"
  if (router.query.view === "feedback") {
    initialView = "feedback"
  } else if (router.query.view === "fix") {
    initialView = "fix"
  } else {
    router.replace({ query: { ...router.query, view: "fix" } }, undefined, {
      shallow: true,
    })
    initialView = "fix"
  }

  let initialPending: boolean
  if (router.query.pending) {
    initialPending = router.query.pending === "true"
  } else {
    router.replace({ query: { ...router.query, pending: true } }, undefined, {
      shallow: true,
    })
    initialPending = true
  }
  const [view, setView] = useState<"feedback" | "fix">(initialView)
  const [pending, setPending] = useState(initialPending)

  return (
    <Layout frontPageUrl={basePath()} navVariant={"complex"}>
      <div className={wideWidthCenteredComponentStyles}>
        <h3>Feedback</h3>
        <Paper square>
          <Tabs
            value={view}
            onChange={(_, value) => {
              router.replace({ query: { ...router.query, view: value } }, undefined, {
                shallow: true,
              })
              setView(value)
            }}
          >
            <Tab label="Quick fixes" value={"fix"} />
            <Tab label="Written feedback" value={"feedback"} />
          </Tabs>
          <Tabs
            value={pending}
            onChange={(_, value) => {
              router.replace({ query: { ...router.query, pending: value } }, undefined, {
                shallow: true,
              })
              setPending(value)
            }}
          >
            <Tab label="Pending" value={true} />
            <Tab label="Old" value={false} />
          </Tabs>
        </Paper>
        {view === "feedback" && <FeedbackList courseId={courseId} pending={pending} perPage={1} />}
        {view === "fix" && <EditProposalList courseId={courseId} pending={pending} perPage={1} />}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(FeedbackPage)))

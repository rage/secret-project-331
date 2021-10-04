import { Paper, Tab, Tabs } from "@material-ui/core"
import { useRouter } from "next/router"
import React, { useState } from "react"

import Layout from "../../../../components/Layout"
import EditProposalList from "../../../../components/lists/EditProposalList"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { wideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface ChangeRequestsProps {
  query: SimplifiedUrlQuery<"id">
}

const ChangeRequestsPage: React.FC<ChangeRequestsProps> = ({ query }) => {
  const router = useRouter()

  const courseId = query.id

  let initialPending: boolean
  if (router.query.pending) {
    initialPending = router.query.pending === "true"
  } else {
    router.replace({ query: { ...router.query, pending: true } }, undefined, {
      shallow: true,
    })
    initialPending = true
  }
  const [pending, setPending] = useState(initialPending)

  return (
    <Layout navVariant={"complex"}>
      <div className={wideWidthCenteredComponentStyles}>
        <h3>Change requests</h3>
        <Paper square>
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
        <EditProposalList courseId={courseId} pending={pending} perPage={4} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ChangeRequestsPage)),
)

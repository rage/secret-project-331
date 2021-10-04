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

  // 0 == first tab, pending
  // 1 == second tab, old
  const intialTab = initialPending ? 0 : 1
  const [tab, setTab] = useState(intialTab)
  const pending = tab == 0
  return (
    <Layout navVariant={"complex"}>
      <div className={wideWidthCenteredComponentStyles}>
        <h3>Change requests</h3>
        <Paper square>
          <Tabs
            value={tab}
            onChange={(_, value) => {
              router.replace({ query: { ...router.query, pending: value == 0 } }, undefined, {
                shallow: true,
              })
              setTab(value)
            }}
          >
            <Tab label="Pending" value={0} />
            <Tab label="Old" value={1} />
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

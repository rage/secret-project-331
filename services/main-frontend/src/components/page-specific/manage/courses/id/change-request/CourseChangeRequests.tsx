import { Paper, Tab, Tabs } from "@material-ui/core"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseOverviewTabsProps } from "../index/CourseOverviewTabNavigator"

import EditProposalList from "./EditProposalList"

const ChangeRequestsPage: React.FC<CourseOverviewTabsProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const router = useRouter()

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
    <div>
      <h3>{t("title-change-requests")}</h3>
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
          <Tab label={t("pending")} value={0} />
          <Tab label={t("old")} value={1} />
        </Tabs>
      </Paper>
      {/* TODO: Dropdown for perPage? */}
      <EditProposalList courseId={courseId} pending={pending} perPage={4} />
    </div>
  )
}

export default ChangeRequestsPage

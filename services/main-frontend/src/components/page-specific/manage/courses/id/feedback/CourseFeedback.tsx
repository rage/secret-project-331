import { Paper, Tab, Tabs } from "@material-ui/core"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"

import FeedbackList from "./FeedbackList"

const CourseFeedback: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const router = useRouter()

  let initialRead: boolean
  if (router.query.read) {
    initialRead = router.query.read === "true"
  } else {
    router.replace({ query: { ...router.query, read: false } }, undefined, {
      shallow: true,
    })
    initialRead = false
  }

  // 0 == first tab, unread
  // 1 == second tab, read
  const intialTab = initialRead ? 1 : 0
  const [tab, setTab] = useState(intialTab)
  const read = tab == 1
  return (
    <div>
      <h3>{t("title-feedback")}</h3>
      <Paper square>
        <Tabs
          value={tab}
          onChange={(_, value) => {
            router.replace({ query: { ...router.query, read: value == 1 } }, undefined, {
              shallow: true,
            })
            setTab(value)
          }}
        >
          <Tab label={t("undread")} value={0} />
          <Tab label={t("read")} value={1} />
        </Tabs>
      </Paper>
      <FeedbackList courseId={courseId} read={read} perPage={4} />
    </div>
  )
}

export default CourseFeedback

import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import Tab from "../../../../../Tab"
import Tabs from "../../../../../Tabs"

import FeedbackList from "./FeedbackList"

const CourseFeedback: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const [read, setRead] = useState(false)
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    if (router.query.read) {
      setRead(router.query.read === "true")
    }
  }, [router.query.read])

  return (
    <div>
      <h3>{t("title-feedback")}</h3>
      <Tabs disableRouting>
        <Tab
          isActive={!read}
          url={{ pathname: router.pathname, query: { ...router.query, read: false } }}
        >
          {t("unread")}
        </Tab>
        <Tab
          isActive={read}
          url={{ pathname: router.pathname, query: { ...router.query, read: true } }}
        >
          {t("read")}
        </Tab>
      </Tabs>
      <FeedbackList courseId={courseId} read={read} perPage={4} />
    </div>
  )
}

export default CourseFeedback

import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import createUnreadFeedbackCountHook from "../../../../../../hooks/count/useUnreadFeedbackCount"
import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import TabLink from "../../../../../../shared-module/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "../../../../../../shared-module/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "../../../../../../shared-module/components/Navigation/TabLinks/TabLinkPanel"

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
      <TabLinkNavigation>
        <TabLink
          isActive={!read}
          url={{ pathname: router.pathname, query: { ...router.query, read: false } }}
          countHook={createUnreadFeedbackCountHook(courseId)}
        >
          {t("unread")}
        </TabLink>
        <TabLink
          isActive={read}
          url={{ pathname: router.pathname, query: { ...router.query, read: true } }}
        >
          {t("read")}
        </TabLink>
      </TabLinkNavigation>
      <TabLinkPanel>
        <FeedbackList courseId={courseId} read={read} perPage={4} />
      </TabLinkPanel>
    </div>
  )
}

export default CourseFeedback

import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"

import FeedbackList from "./FeedbackList"

import createUnreadFeedbackCountHook from "@/hooks/count/useUnreadFeedbackCount"
import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

const CourseFeedback: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
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
      <h3
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("title-feedback")}
      </h3>
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
        <FeedbackList courseId={courseId} read={read} />
      </TabLinkPanel>
    </div>
  )
}

export default CourseFeedback

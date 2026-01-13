"use client"
import { css } from "@emotion/css"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import FeedbackList from "./FeedbackList"

import { CourseManagementPagesProps } from "@/app/manage/courses/[id]/[...path]/page"
import createUnreadFeedbackCountHook from "@/hooks/count/useUnreadFeedbackCount"
import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"

const CourseFeedback: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const [read, setRead] = useState(false)
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const readParam = searchParams.get("read")
    if (readParam) {
      setRead(readParam === "true")
    }
  }, [searchParams])

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
          url={{ pathname, query: { read: false } }}
          countHook={createUnreadFeedbackCountHook(courseId)}
        >
          {t("unread")}
        </TabLink>
        <TabLink isActive={read} url={{ pathname, query: { read: true } }}>
          {t("read")}
        </TabLink>
      </TabLinkNavigation>
      <TabLinkPanel>
        <FeedbackList courseId={courseId} read={read} />
      </TabLinkPanel>
    </div>
  )
}

export default withSuspenseBoundary(CourseFeedback)

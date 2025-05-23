import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"

import EditProposalList from "./EditProposalList"

import createPendingChangeRequestCountHook from "@/hooks/count/usePendingChangeRequestCount"
import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

const ChangeRequestsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const [pending, setPending] = useState(true)
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    if (router.query.pending) {
      setPending(router.query.pending === "true")
    }
  }, [router.query.pending])

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
        {t("title-change-requests")}
      </h3>
      {}
      <TabLinkNavigation>
        <TabLink
          url={{ pathname: router.pathname, query: { ...router.query, pending: true } }}
          isActive={pending}
          countHook={createPendingChangeRequestCountHook(courseId)}
        >
          {t("pending")}
        </TabLink>
        <TabLink
          url={{ pathname: router.pathname, query: { ...router.query, pending: false } }}
          isActive={!pending}
        >
          {t("old")}
        </TabLink>
      </TabLinkNavigation>
      {/* TODO: Dropdown for perPage? */}
      <TabLinkPanel>
        <EditProposalList courseId={courseId} pending={pending} perPage={4} />
      </TabLinkPanel>
    </div>
  )
}

export default ChangeRequestsPage

import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import createPendingChangeRequestCountHook from "../../../../../../hooks/count/usePendingChangeRequestCount"
import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import TabLink from "../../../../../TabLink"
import TabLinkNavigation from "../../../../../TabLinkNavigation"

import EditProposalList from "./EditProposalList"

const ChangeRequestsPage: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
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
      <h3>{t("title-change-requests")}</h3>
      {/* eslint-disable-next-line i18next/no-literal-string */}
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
      <EditProposalList courseId={courseId} pending={pending} perPage={4} />
    </div>
  )
}

export default ChangeRequestsPage

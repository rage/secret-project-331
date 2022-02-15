import { useRouter } from "next/router"
import React from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import TabNavigation from "../../../../../TabNavigation"

import EditProposalList from "./EditProposalList"

const ChangeRequestsPage: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const router = useRouter()

  let pending: boolean
  if (router.query.pending) {
    pending = router.query.pending === "true"
  } else {
    router.replace({ query: { ...router.query, pending: true } }, undefined, {
      shallow: true,
    })
    pending = true
  }

  return (
    <div>
      <h3>{t("title-change-requests")}</h3>
      <TabNavigation
        tabs={[
          {
            title: t("pending"),
            url: { pathname: router.pathname, query: { ...router.query, pending: true } },
            isActive: pending,
          },
          {
            title: t("old"),
            url: { pathname: router.pathname, query: { ...router.query, pending: false } },
            isActive: !pending,
          },
        ]}
      />
      {/* TODO: Dropdown for perPage? */}
      <EditProposalList courseId={courseId} pending={pending} perPage={4} />
    </div>
  )
}

export default ChangeRequestsPage

import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import Tab from "../../../../../Tab"
import Tabs from "../../../../../Tabs"

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
      <Tabs disableRouting>
        <Tab
          url={{ pathname: router.pathname, query: { ...router.query, pending: true } }}
          isActive={pending}
        >
          {t("pending")}
        </Tab>
        <Tab
          url={{ pathname: router.pathname, query: { ...router.query, pending: false } }}
          isActive={!pending}
        >
          {t("old")}
        </Tab>
      </Tabs>
      {/* TODO: Dropdown for perPage? */}
      <EditProposalList courseId={courseId} pending={pending} perPage={4} />
    </div>
  )
}

export default ChangeRequestsPage

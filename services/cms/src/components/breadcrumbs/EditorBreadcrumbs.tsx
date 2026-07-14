"use client"

import { useRouter } from "next/router"
import React from "react"

import usePageInfo from "../../hooks/usePageInfo"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"

import Breadcrumbs from "@/shared-module/common/components/Breadcrumbs"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"

const EditorBreadcrumbs: React.FC = () => {
  const router = useRouter()

  const pathParts = router.asPath ? router.asPath.split("/") : []
  const pageId = pathParts.length > 2 ? pathParts[2] : ""
  const prefix = pathParts.length > 1 ? pathParts[1] : ""

  const pageInfoQuery = usePageInfo(pageId, prefix)

  // The query is disabled until the route is a valid page route. While disabled it stays in a
  // pending/idle state forever, so render nothing instead of an endless loading state.
  if (pageInfoQuery.fetchStatus === "idle" && pageInfoQuery.isPending) {
    return null
  }

  return (
    <QueryResult query={pageInfoQuery}>
      {(data) => {
        const pageTitle = data.page_title
        const courseId = data.course_id
        const courseName = data.course_name

        // Exams might now have courseId and the CMS breadcrumb will be broken
        if (!courseId || !courseName) {
          return null
        }
        /* oxlint-disable i18next/no-literal-string */
        const pieces = [
          {
            text: courseName,
            url: `/manage/courses/${courseId}/pages`,
            externalLink: true,
          },
          {
            text: pageTitle,
            url: "#",
          },
        ]

        return (
          <BreakFromCentered {...breakFromCenteredProps}>
            <Breadcrumbs pieces={pieces} />
          </BreakFromCentered>
        )
      }}
    </QueryResult>
  )
}

export default EditorBreadcrumbs

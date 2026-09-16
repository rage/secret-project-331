"use client"

import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React from "react"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { Breadcrumbs, type BreadcrumbItem } from "@/shared-module/components"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"

import usePageInfo from "../../hooks/usePageInfo"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"

/**
 * The trail's own gutter. `BreakFromCentered` spans the viewport and leaves the crumbs to space
 * themselves; without this the first one starts at the window edge.
 */
const breadcrumbBarCss = css`
  padding: 1rem 2rem;
`

const EditorBreadcrumbs: React.FC = () => {
  const router = useRouter()

  const pathParts = router.asPath ? router.asPath.split("/") : []
  const pageId = pathParts.length > 2 ? (pathParts[2] ?? "") : ""
  const prefix = pathParts.length > 1 ? (pathParts[1] ?? "") : ""

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

        const items: BreadcrumbItem[] = [
          {
            label: courseName,
            // oxlint-disable-next-line i18next/no-literal-string -- route, not user-visible text
            href: `/manage/courses/${courseId}/pages`,
            isExternal: true,
          },
          {
            label: pageTitle,
          },
        ]

        return (
          <BreakFromCentered {...breakFromCenteredProps}>
            <Breadcrumbs items={items} className={breadcrumbBarCss} />
          </BreakFromCentered>
        )
      }}
    </QueryResult>
  )
}

export default EditorBreadcrumbs

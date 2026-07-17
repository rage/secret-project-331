"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { renderReadOnlyBlockingError } from "@/components/queryResultErrorRenderers"
import { getCourseMaterialPageChapterAndCourseInformation } from "@/generated/course-material-api/sdk.generated"
import type {
  Page,
  PageChapterAndCourseInformation,
} from "@/generated/course-material-api/types.generated"
import Breadcrumbs from "@/shared-module/common/components/Breadcrumbs"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

interface CourseMaterialPageBreadcrumbsProps {
  page: Page | null
  currentPagePath: string
}

const CourseMaterialPageBreadcrumbs: React.FC<
  React.PropsWithChildren<CourseMaterialPageBreadcrumbsProps>
> = ({ page, currentPagePath }) => {
  const isCourseFrontPage = currentPagePath === "/"
  const { t } = useTranslation()
  const pageChapterAndCourseInformationQuery = useQuery({
    queryKey: [`page-chapter-and-course-${page?.id}`, page, page?.id],
    // oxlint-disable-next-line require-await -- react-query queryFn is annotated to return a Promise
    queryFn: async (): Promise<PageChapterAndCourseInformation | null> => {
      if (!page) {
        return null
      }
      return getCourseMaterialPageChapterAndCourseInformation({
        path: {
          current_page_id: page.id,
        },
      })
    },
    enabled: !!page && !isCourseFrontPage,
  })

  if (isCourseFrontPage) {
    return null
  }

  if (!page) {
    return null
  }

  return (
    <QueryResult
      query={pageChapterAndCourseInformationQuery}
      treatNullAsEmpty
      renderBlockingError={renderReadOnlyBlockingError}
    >
      {(data) => {
        if (data === null) {
          // Unreachable: `treatNullAsEmpty` routes null to `emptyFallback`. Narrowing for TypeScript only.
          return null
        }
        const chapterName = data.chapter_name
        const chapterNumber = data.chapter_number
        const pageOrderNumber = page.order_number
        const chapterFrontPageId = data.chapter_front_page_id
        const isChapterFrontPage = chapterFrontPageId && page.id === chapterFrontPageId
        // oxlint-disable-next-line i18next/no-literal-string
        const courseUrlPrefix = `/org/${data.organization_slug}/courses/${data.course_slug}`

        const pieces = [{ text: data.course_name ?? t("course"), url: courseUrlPrefix }]
        if (page.chapter_id) {
          pieces.push({
            text: t("chapter-chapter-number-chapter-name", { chapterName, chapterNumber }),
            url: `${courseUrlPrefix}${data.chapter_front_page_url_path}`,
          })
        }
        if (!isChapterFrontPage && !isCourseFrontPage) {
          if (page.chapter_id) {
            pieces.push({
              text: `${pageOrderNumber}: ${page.title}`,
              url: `${courseUrlPrefix}${page.url_path}}`,
            })
          } else {
            pieces.push({ text: page.title, url: `${courseUrlPrefix}${page.url_path}}` })
          }
        }

        return (
          <BreakFromCentered sidebar={false}>
            <Breadcrumbs pieces={pieces} />
          </BreakFromCentered>
        )
      }}
    </QueryResult>
  )
}

export default withErrorBoundary(CourseMaterialPageBreadcrumbs)

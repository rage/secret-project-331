import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchPageChapterAndCourse } from "../../services/backend"
import { Page } from "../../shared-module/bindings"
import Breadcrumbs from "../../shared-module/components/Breadcrumbs"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

interface CourseMaterialPageBreadcrumbsProps {
  page: Page | null
  currentPagePath: string
}

const CourseMaterialPageBreadcrumbs: React.FC<
  React.PropsWithChildren<CourseMaterialPageBreadcrumbsProps>
> = ({ page, currentPagePath }) => {
  const isCourseFrontPage = currentPagePath === "/"
  const { t } = useTranslation()
  const data = useQuery({
    queryKey: [`page-chapter-and-course-${page?.id}`, page, page?.id],
    queryFn: () => {
      if (!page) {
        return null
      }
      return fetchPageChapterAndCourse(page.id)
    },
    enabled: !!page && !isCourseFrontPage,
  })

  if (isCourseFrontPage) {
    return null
  }

  if (!page) {
    return null
  }

  if (data.isError) {
    return <ErrorBanner variant={"readOnly"} error={data.error} />
  }

  if (data.isLoading) {
    return <Spinner variant={"small"} />
  }

  if (!data.data) {
    return null
  }

  const chapterName = data.data?.chapter_name
  const chapterNumber = data.data?.chapter_number
  const pageOrderNumber = page.order_number
  const chapterFrontPageId = data.data?.chapter_front_page_id
  const isChapterFrontPage = chapterFrontPageId && page.id === chapterFrontPageId
  // eslint-disable-next-line i18next/no-literal-string
  const courseUrlPrefix = `/${data.data.organization_slug}/courses/${data.data.course_slug}`

  const pieces = [{ text: data.data?.course_name ?? t("course"), url: courseUrlPrefix }]
  if (page.chapter_id) {
    pieces.push({
      text: t("chapter-chapter-number-chapter-name", { chapterName, chapterNumber }),
      url: `${courseUrlPrefix}${data.data.chapter_front_page_url_path}`,
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
}

export default withErrorBoundary(CourseMaterialPageBreadcrumbs)

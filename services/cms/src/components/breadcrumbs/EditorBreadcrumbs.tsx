import { useRouter } from "next/router"
import React from "react"
import { useQuery } from "react-query"

import { fetchPageInfo } from "../../services/backend/pages"
import Breadcrumbs from "../../shared-module/components/Breadcrumbs"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"

const EditorBreadcrumbs: React.FC = () => {
  const router = useRouter()

  const pageId = router.asPath.split("/")[2]
  const data = useQuery(`page-with-id-${pageId}`, () => {
    if (!pageId) {
      return null
    }
    return fetchPageInfo(pageId)
  })

  if (!data) {
    return (
      <BreakFromCentered {...breakFromCenteredProps}>
        <Breadcrumbs pieces={[]} />
      </BreakFromCentered>
    )
  }

  if (data.isError) {
    return <ErrorBanner variant={"readOnly"} error={data.error} />
  }

  if (data.isLoading || data.isIdle) {
    return <Spinner variant={"small"} />
  }

  if (!data.data) {
    return null
  }

  const pageTitle = data.data.page_title
  const courseId = data.data.course_id
  const courseName = data.data.course_name
  /* eslint-disable i18next/no-literal-string */
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
}

export default EditorBreadcrumbs

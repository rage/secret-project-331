import { useRouter } from "next/router"
import React from "react"

import usePageInfo from "../../hooks/usePageInfo"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"

import Breadcrumbs from "@/shared-module/common/components/Breadcrumbs"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

const EditorBreadcrumbs: React.FC<React.PropsWithChildren<unknown>> = () => {
  const router = useRouter()

  const pageId = router.asPath.split("/")[2]
  const prefix = router.asPath.split("/")[1]

  const data = usePageInfo(pageId, prefix)

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

  if (data.isPending) {
    return <Spinner variant={"small"} />
  }

  if (!data.data) {
    return null
  }

  const pageTitle = data.data.page_title
  const courseId = data.data.course_id
  const courseName = data.data.course_name

  // Exams might now have courseId and the CMS breadcrumb will be broken
  if (!courseId || !courseName) {
    return null
  }
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

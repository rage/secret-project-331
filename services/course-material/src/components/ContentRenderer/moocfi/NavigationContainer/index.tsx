import React, { useContext } from "react"

import CoursePageContext from "../../../../contexts/CoursePageContext"
import useQueryParameter from "../../../../hooks/useQueryParameter"
import Spinner from "../../../../shared-module/components/Spinner"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"

import NextPage from "./NextPage"

const NavigationContainer: React.FC = () => {
  const pageContext = useContext(CoursePageContext)
  const courseSlug = useQueryParameter("courseSlug")
  const organizationSlug = useQueryParameter("organizationSlug")

  if (pageContext.state !== "ready") {
    return <Spinner variant={"medium"} />
  }

  return (
    <div className={normalWidthCenteredComponentStyles}>
      <NextPage
        chapterId={pageContext.pageData.chapter_id}
        currentPageId={pageContext.pageData.id}
        courseSlug={courseSlug}
        organizationSlug={organizationSlug}
      />
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(NavigationContainer)

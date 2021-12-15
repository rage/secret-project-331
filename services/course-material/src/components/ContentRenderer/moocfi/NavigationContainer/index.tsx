import React, { useContext } from "react"

import CoursePageContext from "../../../../contexts/CoursePageContext"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import GenericLoading from "../../../GenericLoading"

import NextPage from "./NextPage"

const NavigationContainer: React.FC = () => {
  const pageContext = useContext(CoursePageContext)
  const courseSlug = useQueryParameter("courseSlug")
  const organizationSlug = useQueryParameter("organizationSlug")

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  if (!courseSlug || !organizationSlug) {
    return <GenericLoading />
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

export default NavigationContainer

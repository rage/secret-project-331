import React, { useContext } from "react"

import PageContext from "../../../../contexts/PageContext"
import Spinner from "../../../../shared-module/components/Spinner"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"

import NextPage from "./NextPage"

const NavigationContainer: React.FC = () => {
  const pageContext = useContext(PageContext)
  const courseSlug = useQueryParameter("courseSlug")
  const organizationSlug = useQueryParameter("organizationSlug")

  if (pageContext.state !== "ready") {
    return <Spinner variant={"medium"} />
  }

  return (
    <div>
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

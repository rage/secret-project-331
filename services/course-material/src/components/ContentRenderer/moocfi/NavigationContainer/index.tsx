import React, { useContext } from "react"

import NextPage from "./NextPage"

import PageContext from "@/contexts/PageContext"
import Spinner from "@/shared-module/common/components/Spinner"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const NavigationContainer: React.FC<React.PropsWithChildren> = () => {
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

export default withErrorBoundary(NavigationContainer)

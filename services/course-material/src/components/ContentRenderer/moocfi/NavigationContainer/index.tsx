import React, { useContext } from "react"

import PageContext from "../../../../contexts/PageContext"

import NextPage from "./NextPage"

import Spinner from "@/shared-module/common/components/Spinner"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import dontRenderUntilQueryParametersReady from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface NavigationContainerProps {
  chapterProgress: {
    maxScore: string
    givenScore: string
    attemptedExercises: string
    totalExercises: string
  }
}

const NavigationContainer: React.FC<React.PropsWithChildren<NavigationContainerProps>> = ({
  chapterProgress,
}) => {
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
        chapterProgress={chapterProgress}
      />
    </div>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(NavigationContainer))

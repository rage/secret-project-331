"use client"
import { useParams } from "next/navigation"
import React, { useContext } from "react"

import NextPage from "./NextPage"

import LayoutContext from "@/contexts/LayoutContext"
import PageContext from "@/contexts/PageContext"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const NavigationContainer: React.FC<React.PropsWithChildren> = () => {
  const pageContext = useContext(PageContext)
  const layoutContext = useContext(LayoutContext)
  const params = useParams<{ organizationSlug: string; courseSlug: string }>()
  const courseSlug = params?.courseSlug
  const organizationSlug = layoutContext.organizationSlug

  if (pageContext.state !== "ready") {
    return <Spinner variant={"medium"} />
  }

  if (!organizationSlug || !courseSlug) {
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

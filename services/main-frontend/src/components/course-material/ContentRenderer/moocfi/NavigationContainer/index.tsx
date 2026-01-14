"use client"

import { useAtomValue } from "jotai"
import { useParams } from "next/navigation"
import React from "react"

import NextPage from "./NextPage"

import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  currentChapterIdAtom,
  currentPageIdAtom,
  viewStatusAtom,
} from "@/state/course-material/selectors"
import { organizationSlugAtom } from "@/state/layoutAtoms"

const NavigationContainer: React.FC<React.PropsWithChildren> = () => {
  const viewStatus = useAtomValue(viewStatusAtom)
  const chapterId = useAtomValue(currentChapterIdAtom)
  const pageId = useAtomValue(currentPageIdAtom)
  const organizationSlug = useAtomValue(organizationSlugAtom)
  const params = useParams<{ organizationSlug: string; courseSlug: string }>()
  const courseSlug = params?.courseSlug

  if (viewStatus !== "ready") {
    return <Spinner variant={"medium"} />
  }

  if (!organizationSlug || !courseSlug || !pageId) {
    return <Spinner variant={"medium"} />
  }

  return (
    <div>
      <NextPage
        chapterId={chapterId}
        currentPageId={pageId}
        courseSlug={courseSlug}
        organizationSlug={organizationSlug}
      />
    </div>
  )
}

export default withErrorBoundary(NavigationContainer)

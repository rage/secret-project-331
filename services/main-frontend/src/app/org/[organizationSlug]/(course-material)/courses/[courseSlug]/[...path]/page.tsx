"use client"

import { useAtomValue, useSetAtom } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { useParams, useRouter } from "next/navigation"
import React, { useEffect, useMemo } from "react"

import Page from "@/components/course-material/Page"
import PageNotFound from "@/components/course-material/PageNotFound"
import CourseMaterialPageBreadcrumbs from "@/components/course-material/navigation/CourseMaterialPageBreadcrumbs"
import CourseTestModeNotification from "@/components/course-material/notifications/CourseTestModeNotification"
import { useLanguageOptions } from "@/contexts/LanguageOptionsContext"
import useLanguageNavigation from "@/hooks/course-material/useLanguageNavigation"
import useScrollToSelector from "@/hooks/course-material/useScrollToSelector"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { PageMarginOffset } from "@/shared-module/common/components/layout/PageMarginOffset"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "@/shared-module/common/utils/constants"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { courseMaterialAtom } from "@/state/course-material"
import { viewParamsAtom } from "@/state/course-material/params"
import {
  currentCourseIdAtom,
  currentPageIdAtom,
  refetchViewAtom,
} from "@/state/course-material/selectors"
import { organizationSlugAtom } from "@/state/layoutAtoms"

const PagePage: React.FC = () => {
  const router = useRouter()
  const languageOptions = useLanguageOptions()
  const params = useParams<{ organizationSlug: string; courseSlug: string; path: string[] }>()
  if (params === null) {
    throw new Error("Params are null (and they are not supposed to be)")
  }
  const organizationSlug = params.organizationSlug
  const courseSlug = params.courseSlug
  const path = useMemo(() => `/${params.path?.join("/") || ""}`, [params.path])

  // Stable object reference for view params
  const viewParams = useMemo(
    () => ({
      type: "material" as const,
      courseSlug: params.courseSlug,
      path: path,
    }),
    [params.courseSlug, path],
  )

  // Initialize atoms synchronously on first render
  useHydrateAtoms(
    useMemo(
      () =>
        [
          [organizationSlugAtom, organizationSlug],
          [viewParamsAtom, viewParams],
        ] as const,
      [organizationSlug, viewParams],
    ),
  )

  // Read unified state
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const courseId = useAtomValue(currentCourseIdAtom)
  const pageId = useAtomValue(currentPageIdAtom)

  // Use language navigation hook
  const languageNavigation = useLanguageNavigation({
    currentCourseId: courseId,
    currentPageId: pageId,
  })

  // Update language options context when available languages change
  useEffect(() => {
    if (languageOptions && languageNavigation.availableLanguages.length > 0) {
      languageOptions.setAvailableLanguages(languageNavigation.availableLanguages)
    }
    return () => {
      // Clear language options when unmounting
      if (languageOptions) {
        languageOptions.clearAvailableLanguages()
      }
    }
  }, [languageNavigation.availableLanguages, languageOptions])

  // Handle if the page was redirected to a different path
  useEffect(() => {
    if (
      courseMaterialState.status !== "ready" ||
      !courseMaterialState.page ||
      !courseMaterialState.wasRedirected
    ) {
      return
    }
    // want to keep the same page, since the page content is already correct, just
    // want to fix the url without creating a history entry
    const currentPathName = document.location.pathname
    const courseSlugEndLocation = currentPathName.indexOf(courseSlug) + courseSlug.length
    const beginningOfNewPath = currentPathName.substring(0, courseSlugEndLocation)
    const newPath = `${beginningOfNewPath}${courseMaterialState.page.url_path}`

    console.info(`Redirecting to ${newPath}`)
    router.replace(newPath)
  }, [courseSlug, courseMaterialState, router])

  // Handle scrolling to selector if window has anchor
  useScrollToSelector(path)

  // Handle refresh
  const triggerRefetch = useSetAtom(refetchViewAtom)
  const handleRefresh = async () => {
    await triggerRefetch()
  }

  // Error handling
  if (courseMaterialState.error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((courseMaterialState.error as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseSlug} organizationSlug={organizationSlug} />
    }
    return <ErrorBanner variant={"readOnly"} error={courseMaterialState.error} />
  }

  // Loading state
  if (courseMaterialState.status === "loading") {
    return <Spinner variant={"small"} />
  }

  return (
    <>
      <PageMarginOffset marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`} marginBottom={"0rem"}>
        <CourseMaterialPageBreadcrumbs currentPagePath={path} page={courseMaterialState.page} />
        {<CourseTestModeNotification isTestMode={courseMaterialState.isTestMode} />}
      </PageMarginOffset>
      <Page onRefresh={handleRefresh} organizationSlug={organizationSlug} />
    </>
  )
}

export default withErrorBoundary(PagePage)

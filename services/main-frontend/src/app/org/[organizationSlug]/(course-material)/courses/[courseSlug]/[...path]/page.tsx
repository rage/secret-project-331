"use client"

import { useAtomValue, useSetAtom } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { useParams, useRouter } from "next/navigation"
import React, { useEffect, useMemo, useRef } from "react"

import Page from "@/components/course-material/Page"
import PageNotFound from "@/components/course-material/PageNotFound"
import CourseMaterialPageBreadcrumbs from "@/components/course-material/navigation/CourseMaterialPageBreadcrumbs"
import CourseTestModeNotification from "@/components/course-material/notifications/CourseTestModeNotification"
import { useLanguageOptions } from "@/contexts/LanguageOptionsContext"
import useLanguageNavigation from "@/hooks/course-material/language/useLanguageNavigation"
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
import { courseLanguagePreferenceAtom } from "@/state/courseLanguagePreference"
import { organizationSlugAtom } from "@/state/layoutAtoms"
import { useChangeCourseMaterialLanguage } from "@/utils/course-material/languageHelpers"

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

  const setOrganizationSlug = useSetAtom(organizationSlugAtom)
  const setViewParams = useSetAtom(viewParamsAtom)

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

  // Update atoms when params change (e.g., after language redirect)
  useEffect(() => {
    setOrganizationSlug(organizationSlug)
    setViewParams(viewParams)
  }, [organizationSlug, viewParams, setOrganizationSlug, setViewParams])

  // Read unified state
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const courseId = useAtomValue(currentCourseIdAtom)
  const pageId = useAtomValue(currentPageIdAtom)
  const setLanguagePreference = useSetAtom(courseLanguagePreferenceAtom)

  const languageNavigation = useLanguageNavigation({
    currentCourseId: courseId,
    currentPageId: pageId,
  })
  const changeCourseMaterialLanguage = useChangeCourseMaterialLanguage()

  // Store latest value in ref to avoid recreating handler
  const changeLanguageRef = useRef(changeCourseMaterialLanguage)

  useEffect(() => {
    changeLanguageRef.current = changeCourseMaterialLanguage
  }, [changeCourseMaterialLanguage])

  // Reset language preference when course loads or changes
  useEffect(() => {
    if (courseMaterialState.status === "ready" && courseMaterialState.course?.id) {
      // eslint-disable-next-line i18next/no-literal-string
      setLanguagePreference("same-as-course")
    }
  }, [courseMaterialState.status, courseMaterialState.course?.id, setLanguagePreference])

  // Set up language change handler for course material context
  // This only updates the state - the redirect is handled by useCourseMaterialLanguageRedirection hook
  useEffect(() => {
    if (!languageOptions?.setOnLanguageChange) {
      return
    }
    const handler = async (languageCode: string) => {
      changeLanguageRef.current(languageCode)
      // Don't call redirectToLanguage - let useCourseMaterialLanguageRedirection handle it
    }
    languageOptions.setOnLanguageChange(handler)
    return () => {
      if (languageOptions?.setOnLanguageChange) {
        languageOptions.setOnLanguageChange(undefined)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageOptions?.setOnLanguageChange])

  // Update language options context when available languages change
  useEffect(() => {
    if (languageOptions && languageNavigation.availableLanguages.length > 0) {
      languageOptions.setAvailableLanguages(languageNavigation.availableLanguages)
    }
    return () => {
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

  const triggerRefetch = useSetAtom(refetchViewAtom)
  const handleRefresh = async () => {
    await triggerRefetch()
  }

  if (courseMaterialState.error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((courseMaterialState.error as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseSlug} organizationSlug={organizationSlug} />
    }
    return <ErrorBanner variant={"readOnly"} error={courseMaterialState.error} />
  }

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

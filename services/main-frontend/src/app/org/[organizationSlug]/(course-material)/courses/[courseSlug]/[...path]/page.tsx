"use client"

import { useAtomValue, useSetAtom } from "jotai"
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
import NoIndexMeta from "@/shared-module/common/components/NoIndexMeta"
import Spinner from "@/shared-module/common/components/Spinner"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
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

/**
 * Decodes only the non-ASCII (UTF-8 multibyte) percent-escapes in a path segment, leaving
 * reserved ASCII escapes (%2F, %23, %25, ...) encoded. This mirrors the backend's canonical
 * URL path form (`normalize_url_path_for_storage`), so decoding never turns an encoded
 * separator into a structural one and changes the lookup key.
 */
const decodeNonAsciiPercentEscapes = (segment: string): string =>
  // A run of %XX escapes whose lead nibble is 8-F encodes bytes >= 0x80, i.e. a non-ASCII
  // UTF-8 sequence; decode the whole run at once so multibyte characters round-trip.
  segment.replace(/(?:%[89A-Fa-f][0-9A-Fa-f])+/g, (run) => {
    try {
      return decodeURIComponent(run)
    } catch {
      return run
    }
  })

const PagePage: React.FC = () => {
  const router = useRouter()
  const languageOptions = useLanguageOptions()
  const params = useParams<{ organizationSlug: string; courseSlug: string; path: string[] }>()
  if (params === null) {
    throw new Error("Params are null (and they are not supposed to be)")
  }
  const organizationSlug = params.organizationSlug
  const courseSlug = params.courseSlug
  // useParams() returns the catch-all segments still percent-encoded. Decode only the
  // non-ASCII escapes per segment so the path matches the backend's canonical form while
  // reserved ASCII escapes (e.g. %2F) stay encoded and structure is preserved.
  const path = useMemo(() => {
    const decoded = (params.path ?? []).map(decodeNonAsciiPercentEscapes).join("/")
    return `/${decoded}`
  }, [params.path])

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

  // Update atoms when params change (e.g., after language redirect)
  useEffect(() => {
    setOrganizationSlug(organizationSlug)
    setViewParams(viewParams)
  }, [organizationSlug, viewParams, setOrganizationSlug, setViewParams])

  // Read unified state
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const courseId = useAtomValue(currentCourseIdAtom)
  const pageId = useAtomValue(currentPageIdAtom)

  // Specific page title; wins over the layout's course-name baseline once the page resolves.
  usePageTitle(courseMaterialState.page?.title ?? null, { order: 10 })
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
      {/* Keep hidden pages out of search engine indexes (React hoists this into <head>). */}
      <NoIndexMeta noIndex={courseMaterialState.page?.hidden ?? false} />
      <CourseMaterialPageBreadcrumbs currentPagePath={path} page={courseMaterialState.page} />
      {<CourseTestModeNotification isTestMode={courseMaterialState.isTestMode} />}
      <Page onRefresh={handleRefresh} organizationSlug={organizationSlug} />
    </>
  )
}

export default withErrorBoundary(PagePage)

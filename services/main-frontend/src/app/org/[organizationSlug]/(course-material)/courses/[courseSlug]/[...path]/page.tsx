"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import React, { useCallback, useContext, useEffect, useMemo } from "react"

import Page from "@/components/course-material/Page"
import PageNotFound from "@/components/course-material/PageNotFound"
import CourseMaterialPageBreadcrumbs from "@/components/course-material/navigation/CourseMaterialPageBreadcrumbs"
import CourseTestModeNotification from "@/components/course-material/notifications/CourseTestModeNotification"
import { useLanguageOptions } from "@/contexts/LanguageOptionsContext"
import LayoutContext from "@/contexts/course-material/LayoutContext"
import PageContext, { CoursePageDispatch } from "@/contexts/course-material/PageContext"
import useLanguageNavigation from "@/hooks/course-material/useLanguageNavigation"
import useScrollToSelector from "@/hooks/course-material/useScrollToSelector"
import { fetchCoursePageByPath } from "@/services/course-material/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { PageMarginOffset } from "@/shared-module/common/components/layout/PageMarginOffset"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "@/shared-module/common/utils/constants"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const PagePage: React.FC = () => {
  const layoutContext = useContext(LayoutContext)
  const router = useRouter()
  const languageOptions = useLanguageOptions()
  const params = useParams<{ organizationSlug: string; courseSlug: string; path: string[] }>()
  if (params === null) {
    throw new Error("Params are null (and they are not supposed to be)")
  }
  const organizationSlug = params.organizationSlug
  const courseSlug = params.courseSlug
  const path = useMemo(() => `/${params.path?.join("/") || ""}`, [params.path])

  const getCoursePageByPath = useQuery({
    queryKey: [`course-page-${courseSlug}-${path}`],
    queryFn: () => fetchCoursePageByPath(courseSlug, path),
  })

  const { refetch: refetchGetCoursePageByPath } = getCoursePageByPath

  // Get course and page IDs from the data
  const currentCourseId = getCoursePageByPath.data?.page.course_id ?? null
  const currentPageId = getCoursePageByPath.data?.page.id ?? null

  // Use language navigation hook
  const languageNavigation = useLanguageNavigation({
    currentCourseId,
    currentPageId,
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

  const pageState = useContext(PageContext)
  const pageStateDispatch = useContext(CoursePageDispatch)

  const {
    title: layoutTitle,
    setTitle: setLayoutTitle,
    courseId: layoutCourseId,
    setCourseId: setLayoutCourseId,
    organizationSlug: layoutOrganizationSlug,
    setOrganizationSlug: setLayoutOrganizationSlug,
    setPageState: setLayoutPageState,
  } = layoutContext

  useEffect(() => {
    if (getCoursePageByPath.data) {
      if (layoutTitle !== getCoursePageByPath.data.page.title) {
        setLayoutTitle(getCoursePageByPath.data.page.title)
      }
      if (layoutCourseId !== getCoursePageByPath.data.page.course_id) {
        setLayoutCourseId(getCoursePageByPath.data.page.course_id)
      }
    }
    if (layoutOrganizationSlug !== organizationSlug) {
      setLayoutOrganizationSlug(organizationSlug)
    }
    if (setLayoutPageState) {
      setLayoutPageState(pageState)
    }
  }, [
    getCoursePageByPath.data,
    layoutTitle,
    setLayoutTitle,
    layoutCourseId,
    setLayoutCourseId,
    layoutOrganizationSlug,
    setLayoutOrganizationSlug,
    organizationSlug,
    pageState,
    setLayoutPageState,
  ])

  useEffect(() => {
    if (!pageStateDispatch) {
      return
    }
    if (getCoursePageByPath.isError) {
      pageStateDispatch({ type: "setError", payload: getCoursePageByPath.error })
    } else if (getCoursePageByPath.isLoading) {
      pageStateDispatch({ type: "setLoading" })
    } else if (getCoursePageByPath.data) {
      pageStateDispatch({
        type: "setData",
        payload: {
          pageData: getCoursePageByPath.data.page,
          instance: getCoursePageByPath.data.instance ?? null,
          settings: getCoursePageByPath.data.settings ?? null,
          course: getCoursePageByPath.data.course ?? null,
          exam: null,
          isTest: getCoursePageByPath.data.is_test_mode,
          organization: getCoursePageByPath.data.organization ?? null,
        },
      })
    }
  }, [
    getCoursePageByPath.data,
    getCoursePageByPath.error,
    getCoursePageByPath.isError,
    getCoursePageByPath.isLoading,
    getCoursePageByPath.isSuccess,
    pageStateDispatch,
  ])

  // handle if the page was redirected to a different path
  useEffect(() => {
    if (!getCoursePageByPath.data) {
      return
    }
    if (getCoursePageByPath.data.was_redirected) {
      // want to keep the same page, since the page content is already correct, just
      // want to fix the url without creating a history entry
      const currentPathName = document.location.pathname
      const courseSlugEndLocation = currentPathName.indexOf(courseSlug) + courseSlug.length
      const beginningOfNewPath = currentPathName.substring(0, courseSlugEndLocation)
      const newPath = `${beginningOfNewPath}${getCoursePageByPath.data.page.url_path}`

      console.info(`Redirecting to ${newPath}`)
      router.replace(newPath)
    }
  }, [courseSlug, getCoursePageByPath.data, router])

  // Handle scrolling to selector if window has anchor
  useScrollToSelector(path)

  const handleRefresh = useCallback(async () => {
    await refetchGetCoursePageByPath()
  }, [refetchGetCoursePageByPath])

  if (getCoursePageByPath.isError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((getCoursePageByPath.error as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseSlug} organizationSlug={organizationSlug} />
    }
    return <ErrorBanner variant={"readOnly"} error={getCoursePageByPath.error} />
  }

  if (getCoursePageByPath.isLoading || !getCoursePageByPath.data) {
    return <Spinner variant={"small"} />
  }

  return (
    <>
      <PageMarginOffset marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`} marginBottom={"0rem"}>
        <CourseMaterialPageBreadcrumbs currentPagePath={path} page={pageState.pageData} />
        {<CourseTestModeNotification isTestMode={pageState.isTest} />}
      </PageMarginOffset>
      <Page onRefresh={handleRefresh} organizationSlug={organizationSlug} />
    </>
  )
}

export default withErrorBoundary(PagePage)

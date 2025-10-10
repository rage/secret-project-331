'use client'

import { useQuery } from "@tanstack/react-query"
import { useRouter, useParams } from "next/navigation"
import React, { useCallback, useContext, useEffect, useMemo, useReducer } from "react"

import Page from "../../../../components/Page"
import PageNotFound from "../../../../components/PageNotFound"
import CourseMaterialPageBreadcrumbs from "../../../../components/navigation/CourseMaterialPageBreadcrumbs"
import CourseTestModeNotification from "../../../../components/notifications/CourseTestModeNotification"
import LayoutContext from "../../../../contexts/LayoutContext"
import PageContext, {
  CoursePageDispatch,
  getDefaultPageState,
} from "../../../../contexts/PageContext"
import useScrollToSelector from "../../../../hooks/useScrollToSelector"
import pageStateReducer from "../../../../reducers/pageStateReducer"
import { fetchCoursePageByPath } from "../../../../services/backend"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { PageMarginOffset } from "@/shared-module/common/components/layout/PageMarginOffset"
import basePath from "@/shared-module/common/utils/base-path"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "@/shared-module/common/utils/constants"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const PagePage: React.FC = () => {
  const layoutContext = useContext(LayoutContext)
  const router = useRouter()
  const params = useParams<{ organizationSlug: string; courseSlug: string; path: string[] }>()
  const organizationSlug = params.organizationSlug
  const courseSlug = params.courseSlug
  const path = useMemo(() => `/${params.path.join("/")}`, [params.path])

  const getCoursePageByPath = useQuery({
    queryKey: [`course-page-${courseSlug}-${path}`],
    queryFn: () => fetchCoursePageByPath(courseSlug, path),
  })

  const { refetch: refetchGetCoursePageByPath } = getCoursePageByPath

  const pageStateReducerIntializer = useMemo(
    () =>
      getDefaultPageState(async () => {
        await refetchGetCoursePageByPath()
      }),
    [refetchGetCoursePageByPath],
  )
  const [pageState, pageStateDispatch] = useReducer(pageStateReducer, pageStateReducerIntializer)

  useEffect(() => {
    if (getCoursePageByPath.data) {
      if (layoutContext.title !== getCoursePageByPath.data.page.title) {
        layoutContext.setTitle(getCoursePageByPath.data.page.title)
      }
      if (layoutContext.courseId !== getCoursePageByPath.data.page.course_id) {
        layoutContext.setCourseId(getCoursePageByPath.data.page.course_id)
      }
    }
    if (layoutContext.organizationSlug !== organizationSlug) {
      layoutContext.setOrganizationSlug(organizationSlug)
    }
    layoutContext.setPageState(pageState)
  }, [getCoursePageByPath.data, layoutContext, organizationSlug, pageState])

  useEffect(() => {
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

      // Nextjs router adds the base path to the start of the url, so we need to remove it first
      const nextJsAdjustedPath = newPath.substring(basePath().length)

      console.info(`Redirecting to ${newPath} (${nextJsAdjustedPath})`)
      router.replace(nextJsAdjustedPath)
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
    <CoursePageDispatch.Provider value={pageStateDispatch}>
      <PageContext.Provider value={pageState}>
        <PageMarginOffset marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`} marginBottom={"0rem"}>
          <CourseMaterialPageBreadcrumbs currentPagePath={path} page={pageState.pageData} />
          {<CourseTestModeNotification isTestMode={pageState.isTest} />}
        </PageMarginOffset>
        <Page onRefresh={handleRefresh} organizationSlug={organizationSlug} />
      </PageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(PagePage)
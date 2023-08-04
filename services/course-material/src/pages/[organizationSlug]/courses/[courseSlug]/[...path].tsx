import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
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
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { PageMarginOffset } from "../../../../shared-module/components/layout/PageMarginOffset"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import basePath from "../../../../shared-module/utils/base-path"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "../../../../shared-module/utils/constants"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

const PagePage: React.FC = () => {
  const layoutContext = useContext(LayoutContext)
  const router = useRouter()
  const courseSlug = useQueryParameter("courseSlug")
  const pathQueryParameter = useQueryParameter("path")
  const organizationSlug = useQueryParameter("organizationSlug")
  const path = useMemo(() => `/${pathQueryParameter}`, [pathQueryParameter])
  const getCoursePageByPath = useQuery([`course-page-${courseSlug}-${path}`], () =>
    fetchCoursePageByPath(courseSlug, path),
  )

  const pageStateReducerIntializer = useMemo(
    () =>
      getDefaultPageState(async () => {
        await getCoursePageByPath.refetch()
      }),
    [getCoursePageByPath],
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
      // eslint-disable-next-line i18next/no-literal-string
      pageStateDispatch({ type: "setError", payload: getCoursePageByPath.error })
    } else if (getCoursePageByPath.isLoading) {
      // eslint-disable-next-line i18next/no-literal-string
      pageStateDispatch({ type: "setLoading" })
    } else {
      pageStateDispatch({
        // eslint-disable-next-line i18next/no-literal-string
        type: "setData",
        payload: {
          pageData: getCoursePageByPath.data.page,
          instance: getCoursePageByPath.data.instance ?? null,
          settings: getCoursePageByPath.data.settings ?? null,
          exam: null,
          isTest: getCoursePageByPath.data.is_test_mode,
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
      // eslint-disable-next-line i18next/no-literal-string
      console.info(`Redirecting to ${newPath} (${nextJsAdjustedPath})`)
      router.replace(nextJsAdjustedPath, undefined, {
        shallow: true,
      })
    }
  }, [courseSlug, getCoursePageByPath.data, router])

  // Handle scrolling to selector if window has anchor
  useScrollToSelector(path)

  const handleRefresh = useCallback(async () => {
    await getCoursePageByPath.refetch()
  }, [getCoursePageByPath])

  if (getCoursePageByPath.isError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((getCoursePageByPath.error as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseSlug} organizationSlug={organizationSlug} />
    }
    return <ErrorBanner variant={"readOnly"} error={getCoursePageByPath.error} />
  }

  if (getCoursePageByPath.isLoading) {
    return <Spinner variant={"small"} />
  }

  return (
    <CoursePageDispatch.Provider value={pageStateDispatch}>
      <PageContext.Provider value={pageState}>
        <PageMarginOffset
          marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`}
          // eslint-disable-next-line i18next/no-literal-string
          marginBottom={"0rem"}
        >
          <CourseMaterialPageBreadcrumbs currentPagePath={path} page={pageState.pageData} />
          {<CourseTestModeNotification isTestMode={pageState.isTest} />}
        </PageMarginOffset>
        <Page onRefresh={handleRefresh} organizationSlug={organizationSlug} />
      </PageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(PagePage))

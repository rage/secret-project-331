import { useRouter } from "next/router"
import React, { useCallback, useEffect, useReducer } from "react"
import { useQuery } from "react-query"

import CourseMaterialPageBreadcrumbs from "../../../../components/CourseMaterialPageBreadcrumbs"
import Layout from "../../../../components/Layout"
import Page from "../../../../components/Page"
import PageNotFound from "../../../../components/PageNotFound"
import CourseTestModeNotification from "../../../../components/notifications/CourseTestModeNotification"
import PageContext, { CoursePageDispatch, defaultPageState } from "../../../../contexts/PageContext"
import pageStateReducer from "../../../../reducers/pageStateReducer"
import { fetchCoursePageByPath } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import basePath from "../../../../shared-module/utils/base-path"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { tryToScrollToSelector } from "../../../../utils/dom"
import { courseFaqPageRoute } from "../../../../utils/routing"

interface PagePageProps {
  // "organizationSlug" | "courseSlug" | "path"
  query: SimplifiedUrlQuery<string>
}

const PagePage: React.FC<PagePageProps> = ({ query }) => {
  const router = useRouter()
  const courseSlug = query.courseSlug
  const path = `/${useQueryParameter("path")}`

  const [pageState, pageStateDispatch] = useReducer(pageStateReducer, defaultPageState)
  const getCoursePageByPath = useQuery(`course-page-${courseSlug}-${path}`, () =>
    fetchCoursePageByPath(courseSlug, path),
  )

  useEffect(() => {
    if (getCoursePageByPath.isError) {
      // eslint-disable-next-line i18next/no-literal-string
      pageStateDispatch({ type: "setError", payload: getCoursePageByPath.error })
    } else if (getCoursePageByPath.isLoading || getCoursePageByPath.isIdle) {
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
    getCoursePageByPath.isIdle,
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

  useEffect(() => {
    if (typeof window != "undefined" && window.location.hash) {
      const selector = window.location.hash
      setTimeout(() => {
        tryToScrollToSelector(selector)
      }, 100)
      setTimeout(() => {
        tryToScrollToSelector(selector)
      }, 500)
      setTimeout(() => {
        tryToScrollToSelector(selector)
      }, 1000)
      setTimeout(() => {
        tryToScrollToSelector(selector)
      }, 2000)
    }
  }, [path])

  const handleRefresh = useCallback(async () => {
    await getCoursePageByPath.refetch()
  }, [getCoursePageByPath])

  if (getCoursePageByPath.isError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((getCoursePageByPath.error as any)?.response?.status === 404) {
      return (
        <PageNotFound path={path} courseId={courseSlug} organizationSlug={query.organizationSlug} />
      )
    }
    return <ErrorBanner variant={"readOnly"} error={getCoursePageByPath.error} />
  }

  if (getCoursePageByPath.isLoading || getCoursePageByPath.isIdle) {
    return <Spinner variant={"small"} />
  }

  return (
    <CoursePageDispatch.Provider value={pageStateDispatch}>
      <PageContext.Provider value={pageState}>
        <Layout
          faqUrl={courseFaqPageRoute(query.organizationSlug, courseSlug)}
          title={getCoursePageByPath.data.page.title}
          organizationSlug={query.organizationSlug}
          courseSlug={courseSlug}
        >
          <CourseMaterialPageBreadcrumbs currentPagePath={path} page={pageState.pageData} />
          {<CourseTestModeNotification isTestMode={pageState.isTest} />}
          <Page onRefresh={handleRefresh} organizationSlug={query.organizationSlug} />
        </Layout>
      </PageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(PagePage))

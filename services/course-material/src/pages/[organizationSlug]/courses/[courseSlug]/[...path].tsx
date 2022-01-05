import React, { useCallback, useEffect, useReducer } from "react"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import Page from "../../../../components/Page"
import PageNotFound from "../../../../components/PageNotFound"
import CoursePageContext, {
  CoursePageDispatch,
  defaultCoursePageState,
} from "../../../../contexts/CoursePageContext"
import useQueryParameter from "../../../../hooks/useQueryParameter"
import coursePageStateReducer from "../../../../reducers/coursePageStateReducer"
import { fetchCoursePageByPath } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { tryToScrollToSelector } from "../../../../utils/dom"
import { courseFaqPageRoute, courseFrontPageRoute } from "../../../../utils/routing"

interface PagePageProps {
  // "organizationSlug" | "courseSlug" | "path"
  query: SimplifiedUrlQuery<string>
}

const PagePage: React.FC<PagePageProps> = ({ query }) => {
  const courseSlug = query.courseSlug
  const path = `/${useQueryParameter("path")}`

  const [pageState, pageStateDispatch] = useReducer(coursePageStateReducer, defaultCoursePageState)
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
      <CoursePageContext.Provider value={pageState}>
        <Layout
          faqUrl={courseFaqPageRoute(query.organizationSlug, courseSlug)}
          frontPageUrl={courseFrontPageRoute(query.organizationSlug, courseSlug)}
          title={getCoursePageByPath.data.page.title}
          organizationSlug={query.organizationSlug}
          courseSlug={courseSlug}
        >
          <Page onRefresh={handleRefresh} organizationSlug={query.organizationSlug} />
        </Layout>
      </CoursePageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(PagePage))

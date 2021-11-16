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
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { tryToScrollToSelector } from "../../../../utils/dom"

const PagePage: React.FC = () => {
  const courseSlug = useQueryParameter("courseSlug")
  const path = `/${useQueryParameter("path")}`

  const [pageState, pageStateDispatch] = useReducer(coursePageStateReducer, defaultCoursePageState)
  const { error, data, isLoading, refetch } = useQuery(`course-page-${courseSlug}-${path}`, () =>
    fetchCoursePageByPath(courseSlug, path),
  )

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line i18next/no-literal-string
      pageStateDispatch({ type: "setError", payload: error })
    } else if (!isLoading && data) {
      pageStateDispatch({
        // eslint-disable-next-line i18next/no-literal-string
        type: "setData",
        payload: {
          pageData: data.page,
          instance: data.instance ?? null,
          settings: data.settings ?? null,
        },
      })
    } else {
      // eslint-disable-next-line i18next/no-literal-string
      pageStateDispatch({ type: "setLoading" })
    }
  }, [data, error, isLoading])

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
    await refetch()
  }, [refetch])

  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseSlug} />
    }
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  return (
    <CoursePageDispatch.Provider value={pageStateDispatch}>
      <CoursePageContext.Provider value={pageState}>
        <Layout
          //  Not a good idea, but works for now.
          // eslint-disable-next-line i18next/no-literal-string
          faqUrl={"/courses/" + courseSlug + "/faq"}
          // eslint-disable-next-line i18next/no-literal-string
          frontPageUrl={"/courses/" + courseSlug}
          title={data?.page.title}
        >
          <Page onRefresh={handleRefresh} />
        </Layout>
      </CoursePageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(PagePage))

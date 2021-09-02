import { useRouter } from "next/router"
import React, { useCallback, useEffect, useReducer } from "react"

import Layout from "../../components/Layout"
import Page from "../../components/Page"
import PageNotFound from "../../components/PageNotFound"
import CoursePageContext, {
  CoursePageDispatch,
  defaultCoursePageState,
} from "../../contexts/CoursePageContext"
import useQueryParameter from "../../hooks/useQueryParameter"
import coursePageStateReducer from "../../reducers/coursePageStateReducer"
import { fetchCourseInstance, fetchCoursePageByPath } from "../../services/backend"
import useStateQuery from "../../shared-module/hooks/useStateQuery"
import dontRenderUntilQueryParametersReady from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { tryToScrollToSelector } from "../../utils/dom"

const PagePage: React.FC = () => {
  const courseSlug = useQueryParameter("courseSlug")
  const path = `/${useQueryParameter("path")}`
  const router = useRouter()

  const [pageState, pageStateDispatch] = useReducer(coursePageStateReducer, defaultCoursePageState)
  const pageDataQuery = useStateQuery(["course-page", courseSlug, path], (_courseSlug, _path) =>
    fetchCoursePageByPath(_courseSlug, _path),
  )
  const instanceQuery = useStateQuery(
    ["course-instance", pageDataQuery.data?.course_id],
    (courseId) => fetchCourseInstance(courseId),
  )

  useEffect(() => {
    if (pageDataQuery.state === "error") {
      pageStateDispatch({ type: "setError", payload: pageDataQuery.error })
    } else if (pageDataQuery.state === "ready" && instanceQuery.state === "ready") {
      pageStateDispatch({
        type: "setData",
        payload: { pageData: pageDataQuery.data, instance: instanceQuery.data ?? null },
      })
    } else {
      pageStateDispatch({ type: "setLoading" })
    }
  }, [
    instanceQuery.data,
    instanceQuery.state,
    pageDataQuery.data,
    pageDataQuery.error,
    pageDataQuery.state,
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
    await pageDataQuery.refetch()
    await instanceQuery.refetch()
  }, [instanceQuery, pageDataQuery])

  if (pageDataQuery.state === "error") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((pageDataQuery.error as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseSlug} />
    }
    return <pre>{JSON.stringify(pageDataQuery.error, undefined, 2)}</pre>
  }

  return (
    <CoursePageDispatch.Provider value={pageStateDispatch}>
      <CoursePageContext.Provider value={pageState}>
        <Layout
          //  Not a good idea, but works for now.
          faqUrl={"/courses/" + courseSlug + "/faq"}
          frontPageUrl={"/courses/" + courseSlug}
          title={pageDataQuery.data?.title}
          returnToPath={`/login?return_to=${encodeURIComponent(
            process.env.NEXT_PUBLIC_BASE_PATH + router.asPath,
          )}`}
        >
          <Page courseSlug={courseSlug} onRefresh={handleRefresh} />
        </Layout>
      </CoursePageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(PagePage))

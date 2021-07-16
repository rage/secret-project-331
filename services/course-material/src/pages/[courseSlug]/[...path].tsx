import React, { useCallback, useEffect, useReducer } from "react"
import { useQuery } from "react-query"

import Page from "../../components/Page"
import PageNotFound from "../../components/PageNotFound"
import CoursePageContext, {
  CoursePageDispatch,
  defaultCoursePageState,
} from "../../contexts/CoursePageContext"
import useQueryParameter from "../../hooks/useQueryParameter"
import coursePageStateReducer from "../../reducers/coursePageStateReducer"
import { fetchCourseInstance, fetchCoursePageByPath } from "../../services/backend"
import dontRenderUntilQueryParametersReady from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { tryToScrollToSelector } from "../../utils/dom"

const PagePage: React.FC = () => {
  const courseSlug = useQueryParameter("courseSlug")
  const path = `/${useQueryParameter("path")}`

  const [pageState, pageStateDispatch] = useReducer(coursePageStateReducer, defaultCoursePageState)
  const {
    error: pageDataError,
    data: pageData,
    refetch: pageDataRefetch,
  } = useQuery(`course-${courseSlug}-page-${path}`, () => fetchCoursePageByPath(courseSlug, path))
  const {
    data: instanceData,
    isLoading: isInstanceDataLoading,
    refetch: instanceDataRefetch,
  } = useQuery(
    ["course-instance", pageData?.course_id],
    () => fetchCourseInstance((pageData as NonNullable<typeof pageData>).course_id),
    {
      enabled: !!pageData?.course_id,
    },
  )

  useEffect(() => {
    if (pageDataError) {
      pageStateDispatch({ type: "setError", payload: pageDataError })
    } else if (pageData && !isInstanceDataLoading) {
      pageStateDispatch({ type: "setData", payload: { pageData, instance: instanceData ?? null } })
    } else {
      pageStateDispatch({ type: "setLoading" })
    }
  }, [instanceData, isInstanceDataLoading, pageData, pageDataError])

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
    await pageDataRefetch()
    await instanceDataRefetch()
  }, [instanceDataRefetch, pageDataRefetch])

  if (pageDataError) {
    if ((pageDataError as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseSlug} />
    }
    return <pre>{JSON.stringify(pageDataError, undefined, 2)}</pre>
  }

  return (
    <CoursePageDispatch.Provider value={pageStateDispatch}>
      <CoursePageContext.Provider value={pageState}>
        <Page onRefresh={handleRefresh} />
      </CoursePageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(PagePage))

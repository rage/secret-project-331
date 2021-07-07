import React, { useCallback, useEffect, useReducer } from "react"
import { useQuery } from "react-query"

import PageNotFound from "../../components/PageNotFound"
import useQueryParameter from "../../hooks/useQueryParameter"
import { fetchCourseInstance, fetchCoursePageByPath } from "../../services/backend"
import dontRenderUntilQueryParametersReady from "../../utils/dontRenderUntilQueryParametersReady"
import Page from "../../components/Page"
import { tryToScrollToSelector } from "../../utils/dom"
import coursePageStateReducer, { CoursePageState } from "../../reducers/coursePageStateReducer"
import { CoursePageDispatch } from "../../contexts/CoursePageContext"

const initialState: CoursePageState = {
  state: "loading",
  error: null,
  instance: null,
  pageData: null,
}

const PagePage = () => {
  const courseSlug = useQueryParameter("courseSlug")
  const path = `/${useQueryParameter("path")}`

  const [pageState, pageStateDispatch] = useReducer(coursePageStateReducer, initialState)
  const {
    error: pageDataError,
    data: pageData,
    refetch: pageDataRefetch,
  } = useQuery(`course-${courseSlug}-page-${path}`, () => fetchCoursePageByPath(courseSlug, path))
  const { data: instanceData, refetch: InstanceDataRefetch } = useQuery(
    ["course-instance", pageData?.course_id],
    () => fetchCourseInstance((pageData as NonNullable<typeof pageData>).course_id),
    {
      enabled: !!pageData?.course_id,
    },
  )

  useEffect(() => {
    if (pageDataError) {
      pageStateDispatch({ type: "setError", payload: pageDataError })
    } else if (pageData) {
      pageStateDispatch({ type: "setData", payload: { pageData, instance: instanceData ?? null } })
    } else {
      pageStateDispatch({ type: "setLoading" })
    }
  }, [instanceData, pageData, pageDataError])

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
    await InstanceDataRefetch()
  }, [InstanceDataRefetch, pageDataRefetch])

  if (pageDataError) {
    if ((pageDataError as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseSlug} />
    }
    return <pre>{JSON.stringify(pageDataError, undefined, 2)}</pre>
  }

  return (
    <CoursePageDispatch.Provider value={pageStateDispatch}>
      <Page data={pageState} onRefresh={handleRefresh} />
    </CoursePageDispatch.Provider>
  )
}

export default dontRenderUntilQueryParametersReady(PagePage)

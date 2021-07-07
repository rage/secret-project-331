import React, { useEffect } from "react"
import { useQuery } from "react-query"

import PageNotFound from "../../components/PageNotFound"
import useQueryParameter from "../../hooks/useQueryParameter"
import { fetchCourseInstance, fetchCoursePageByPath } from "../../services/backend"
import dontRenderUntilQueryParametersReady from "../../utils/dontRenderUntilQueryParametersReady"
import Page from "../../components/Page"
import { tryToScrollToSelector } from "../../utils/dom"

const PagePage = () => {
  const courseSlug = useQueryParameter("courseSlug")
  const path = `/${useQueryParameter("path")}`

  const pageQuery = useQuery(`course-${courseSlug}-page-${path}`, () =>
    fetchCoursePageByPath(courseSlug, path),
  )
  const pageData = pageQuery.data
  const instanceQuery = useQuery(
    ["course-instance", pageData?.course_id],
    () => fetchCourseInstance((pageData as NonNullable<typeof pageData>).course_id),
    {
      enabled: !!pageQuery.data?.course_id,
    },
  )

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

  const error = pageQuery.error ?? instanceQuery.error

  if (error) {
    if ((error as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseSlug} />
    }
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  return <Page instanceData={instanceQuery.data ?? null} pageData={pageData ?? null} />
}

export default dontRenderUntilQueryParametersReady(PagePage)

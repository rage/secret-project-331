import { useEffect, useState } from "react"
import { useQuery } from "react-query"

import GenericLoading from "../../components/GenericLoading"
import Page from "../../components/Page"
import PageNotFound from "../../components/PageNotFound"
import PageContext, { CoursePageWithInstance } from "../../contexts/PageContext"
import useQueryParameter from "../../hooks/useQueryParameter"
import { fetchCourseInstance, fetchCoursePageByPath } from "../../services/backend"
import { tryToScrollToSelector } from "../../utils/dom"
import dontRenderUntilQueryParametersReady from "../../utils/dontRenderUntilQueryParametersReady"

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
  const [data, setData] = useState<CoursePageWithInstance | null>(null)

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

  useEffect(() => {
    if (pageQuery.data) {
      setData({
        ...pageQuery.data,
        instance: instanceQuery.data,
      })
    }
  }, [pageQuery.data, instanceQuery.data])

  const isLoading = pageQuery.isLoading || instanceQuery.isLoading
  const error = pageQuery.error ?? instanceQuery.error

  if (error) {
    if ((error as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseSlug} />
    }
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <PageContext.Provider value={data}>
      <Page data={data} />
    </PageContext.Provider>
  )
}

export default dontRenderUntilQueryParametersReady(PagePage)

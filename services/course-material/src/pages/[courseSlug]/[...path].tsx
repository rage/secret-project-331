import { useQuery } from "react-query"
import GenericLoading from "../../components/GenericLoading"
import PageNotFound from "../../components/PageNotFound"
import useQueryParameter from "../../hooks/useQueryParameter"
import { fetchCoursePageByPath } from "../../services/backend"
import dontRenderUntilQueryParametersReady from "../../utils/dontRenderUntilQueryParametersReady"
import Page from "../../components/Page"
import PageContext from "../../contexts/PageContext"

const PagePage = () => {
  const courseId = useQueryParameter("courseSlug")
  const path = `/${useQueryParameter("path")}`

  const { isLoading, error, data } = useQuery(`course-${courseId}-page-${path}`, () =>
    fetchCoursePageByPath(courseId, path),
  )

  if (error) {
    if ((error as any)?.response?.status === 404) {
      return <PageNotFound path={path} courseId={courseId} />
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

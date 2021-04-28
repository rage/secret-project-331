import { css } from "@emotion/css"
import { useQuery } from "react-query"
import ContentRenderer from "../../../components/ContentRenderer"
import GenericLoading from "../../../components/GenericLoading"
import PageNotFound from "../../../components/PageNotFound"
import useQueryParameter from "../../../hooks/useQueryParameter"
import { fetchCoursePageByPath } from "../../../services/backend"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import dontRenderUntilQueryParametersReady from "../../../utils/dontRenderUntilQueryParametersReady"

const Page = () => {
  const courseId = useQueryParameter("courseId")
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
    <>
      <h1
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        {data.title}
      </h1>
      <ContentRenderer data={data.content} />
      {/* <pre>{JSON.stringify(data, undefined, 2)}</pre> */}
    </>
  )
}

export default dontRenderUntilQueryParametersReady(Page)

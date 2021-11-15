import { useCallback, useReducer } from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import Page from "../../components/Page"
import CoursePageContext, {
  CoursePageDispatch,
  defaultCoursePageState,
} from "../../contexts/CoursePageContext"
import useQueryParameter from "../../hooks/useQueryParameter"
import coursePageStateReducer from "../../reducers/coursePageStateReducer"
import { fetchPageByExamId } from "../../services/backend"
import dontRenderUntilQueryParametersReady from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const Exam: React.FC = () => {
  const id = useQueryParameter("id")

  const [pageState, pageStateDispatch] = useReducer(coursePageStateReducer, defaultCoursePageState)

  const { error, data, isLoading, refetch } = useQuery(`exam-page-${id}`, () =>
    fetchPageByExamId(id),
  )

  const handleRefresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <div>Loading...</div>
  }

  return (
    <CoursePageDispatch.Provider value={pageStateDispatch}>
      <CoursePageContext.Provider value={pageState}>
        <Layout title={data?.exam_id || ""}>
          <Page onRefresh={handleRefresh} />
        </Layout>
      </CoursePageContext.Provider>
    </CoursePageDispatch.Provider>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Exam))

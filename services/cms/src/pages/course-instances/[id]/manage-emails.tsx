import { css } from "@emotion/css"

import { useQuery } from "react-query"
import Layout from "../../../components/Layout"
import { fetchCourseInstanceEmailTemplates } from "../../../services/backend/courses"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../../shared-module/hooks/useQueryParameter"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"

const CourseInstanceEmailTemplates = () => {
  const courseInstanceId = useQueryParameter("id")
  const { isLoading, error, data, refetch } = useQuery(
    `course-instance-${courseInstanceId}-emails`,
    () => fetchCourseInstanceEmailTemplates(courseInstanceId),
  )

  if (error) {
    return (
      <div>
        <h1>Error</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>Loading page...</div>
  }

  return (
    <Layout>
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>E-mail templates for course.</h1>
      </div>
    </Layout>
  )
}
export default withSignedIn(CourseInstanceEmailTemplates)

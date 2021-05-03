import { useQuery } from "react-query"
import basePath from "../../utils/base-path"
import Link from "next/link"
import Layout from "../../components/Layout"
import dontRenderUntilQueryParametersReady from "../../utils/dontRenderUntilQueryParametersReady"
import useQueryParameter from "../../hooks/useQueryParameter"
import { fetchOrganizationCourses } from "../../services/backend/organizations"
import DebugModal from "../../components/DebugModal"
import { css } from "@emotion/css"

const Organization: React.FC<unknown> = () => {
  const id = useQueryParameter("id")
  const { isLoading, error, data } = useQuery(`organizations`, () => fetchOrganizationCourses(id))

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <>Loading...</>
  }

  return (
    <Layout>
      <h1>Organization courses</h1>

      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {data.map((course) => (
          <div key={course.id}>
            <Link
              href={{
                pathname: `${basePath()}/courses/[id]/overview`,
                query: { id: course.id },
              }}
            >
              {course.name}
            </Link>
          </div>
        ))}
      </div>
      <DebugModal data={data} />
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Organization)

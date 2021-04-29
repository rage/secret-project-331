import { useQuery } from "react-query"
import styled from "@emotion/styled"
import basePath from "../../utils/base-path"
import Link from "next/link"
import Layout from "../../components/Layout"
import dontRenderUntilQueryParametersReady from "../../utils/dontRenderUntilQueryParametersReady"
import useQueryParameter from "../../hooks/useQueryParameter"
import { fetchOrganizationCourses } from "../../services/backend/organizations"

const Title = styled.h1`
  font-size: 24px;
`

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
      <Title>Organization courses</Title>

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
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Organization)

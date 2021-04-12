import { useQuery } from "react-query"
import styled from "styled-components"
import {  fetchOrganizationCourses } from "../../services/backend"
import basePath from "../../utils/base-path"
import Link from "next/link"
import dontRenderUntilQueryParametersReady from "../../utils/dontRenderUntilQueryParametersReady"
import useQueryParameter from "../../hooks/useQueryParameter"

const Title = styled.h1`
  font-size: 24px;
`

 function Organization() {
   const id = useQueryParameter("id")
  const { isLoading, error, data } = useQuery(`organizations`, () =>
  fetchOrganizationCourses(id))

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <>Loading...</>
  }

  return <>
    <Title>Organization courses</Title>

    {data.map(course => <div key={course.id}><Link href={{
            pathname: `${basePath()}/courses/[id]`,
            query: { id: course.id },
          }}><a>{course.name}</a></Link></div>)}
  </>
}

export default dontRenderUntilQueryParametersReady(Organization)

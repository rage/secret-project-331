import { useQuery } from "react-query"
import basePath from "../../utils/base-path"
import Link from "next/link"
import Layout from "../../components/Layout"
import dontRenderUntilQueryParametersReady from "../../utils/dontRenderUntilQueryParametersReady"
import useQueryParameter from "../../hooks/useQueryParameter"
import { fetchOrganizationCourses } from "../../services/backend/organizations"
import DebugModal from "../../components/DebugModal"
import { css } from "@emotion/css"
import NewCourseForm from "../../components/forms/NewCourseForm"
import React, { useState } from "react"
import { Button, Dialog } from "@material-ui/core"

const Organization: React.FC<unknown> = () => {
  const id = useQueryParameter("id")
  const { isLoading, error, data, refetch } = useQuery(`organization-courses`, () =>
    fetchOrganizationCourses(id),
  )

  const [newCourseFormOpen, setNewCourseFormOpen] = useState(false)

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

      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <Button onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}>Add course</Button>

        <Dialog open={newCourseFormOpen} onClose={() => setNewCourseFormOpen(!newCourseFormOpen)}>
          <div>
            <Button onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}>Close</Button>
            <NewCourseForm
              organizationId={id}
              onSubmitForm={() => {
                refetch()
                setNewCourseFormOpen(false)
              }}
            />
          </div>
        </Dialog>
      </div>
      <DebugModal data={data} />
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Organization)

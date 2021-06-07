import { useQuery } from "react-query"
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
            <a href={`/courses/${course.slug}`}>{course.name}</a>{" "}
            <Link href={`/cms/courses/${course.id}/overview`}>Edit</Link>{" "}
            <Link
              href={{
                pathname: "/manage/courses/[id]",
                query: {
                  id: course.id,
                },
              }}
            >
              Manage
            </Link>{" "}
            <Link
              href={{
                pathname: "/manage/courses/[id]/stats",
                query: {
                  id: course.id,
                },
              }}
            >
              Stats
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
          <div
            className={css`
              margin: 1rem;
            `}
          >
            <Button onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}>Close</Button>
            <NewCourseForm
              organizationId={id}
              onSubmitForm={async () => {
                await refetch()
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

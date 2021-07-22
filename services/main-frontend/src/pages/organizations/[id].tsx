import { css } from "@emotion/css"
import { Button, Dialog } from "@material-ui/core"
import Link from "next/link"
import React, { useContext, useState } from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import NewCourseForm from "../../components/forms/NewCourseForm"
import { fetchOrganizationCourses } from "../../services/backend/organizations"
import DebugModal from "../../shared-module/components/DebugModal"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../shared-module/hooks/useQueryParameter"
import dontRenderUntilQueryParametersReady from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const Organization: React.FC<unknown> = () => {
  const id = useQueryParameter("id")
  const { isLoading, error, data, refetch } = useQuery(`organization-courses`, () =>
    fetchOrganizationCourses(id),
  )
  const loginStateContext = useContext(LoginStateContext)

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
            {loginStateContext.signedIn && (
              <>
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
              </>
            )}
          </div>
        ))}
      </div>

      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {loginStateContext.signedIn && (
          <Button onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}>Add course</Button>
        )}

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

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))

import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import Link from "next/link"
import React, { useContext, useState } from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import NewCourseForm from "../../components/forms/NewCourseForm"
import { postNewCourse } from "../../services/backend/courses"
import { fetchOrganizationCourses } from "../../services/backend/organizations"
import { NewCourse } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import DebugModal from "../../shared-module/components/DebugModal"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../shared-module/hooks/useQueryParameter"
import { wideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import basePath from "../../shared-module/utils/base-path"
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

  const handleSubmitNewCourse = async (newCourse: NewCourse) => {
    await postNewCourse(newCourse)
    await refetch()
    setNewCourseFormOpen(false)
  }

  return (
    // Removing frontPageUrl for some unsolved reason returns to organization front page rather than root
    <Layout frontPageUrl="/">
      <div className={wideWidthCenteredComponentStyles}>
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
            <Button
              size="medium"
              variant="primary"
              onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}
            >
              Add course
            </Button>
          )}

          <Dialog open={newCourseFormOpen} onClose={() => setNewCourseFormOpen(!newCourseFormOpen)}>
            <div
              className={css`
                margin: 1rem;
              `}
            >
              <Button
                size="medium"
                variant="secondary"
                onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}
              >
                Close
              </Button>
              <NewCourseForm organizationId={id} onSubmitForm={handleSubmitNewCourse} />
            </div>
          </Dialog>
        </div>
        <DebugModal data={data} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))

import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import Link from "next/link"
import React, { useContext, useState } from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import OrganizationImageWidget from "../../components/OrganizationImageWidget"
import NewCourseForm from "../../components/forms/NewCourseForm"
import { postNewCourse } from "../../services/backend/courses"
import {
  fetchOrganization,
  fetchOrganizationActiveCourses,
  fetchOrganizationCourses,
} from "../../services/backend/organizations"
import { NewCourse } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import DebugModal from "../../shared-module/components/DebugModal"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"
import { wideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

interface OrganizationPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Organization: React.FC<OrganizationPageProps> = ({ query }) => {
  const {
    isLoading: isLoadingOrgCourses,
    error: errorOrgCourses,
    data: dataOrgCourses,
    refetch: refetchOrgCourses,
  } = useQuery(`organization-courses`, () => fetchOrganizationCourses(query.id))

  const {
    isLoading: isLoadingOrgActiveCourses,
    error: errorOrgActiveCourses,
    data: dataOrgActiveCourses,
    refetch: refetchOrgActiveCourses,
  } = useQuery(`organization-active-courses`, () => fetchOrganizationActiveCourses(query.id))

  const {
    isLoading: isLoadingOrg,
    error: errorOrg,
    data: dataOrg,
    refetch: refetchOrg,
  } = useQuery(`organization-${query.id}`, () => fetchOrganization(query.id))

  const loginStateContext = useContext(LoginStateContext)

  const [newCourseFormOpen, setNewCourseFormOpen] = useState(false)
  console.log(dataOrg)

  if (errorOrgCourses) {
    return <pre>{JSON.stringify(errorOrgCourses, undefined, 2)}</pre>
  }

  if (errorOrgActiveCourses) {
    return <pre>{JSON.stringify(errorOrgActiveCourses, undefined, 2)}</pre>
  }

  if (errorOrg) {
    return <pre>{JSON.stringify(errorOrg, undefined, 2)}</pre>
  }

  if (isLoadingOrgCourses || !dataOrgCourses || isLoadingOrg || !dataOrg) {
    return <>Loading...</>
  }

  if (isLoadingOrgActiveCourses || !dataOrgActiveCourses || isLoadingOrgActiveCourses) {
    return <>Loading active courses...</>
  }

  const handleSubmitNewCourse = async (newCourse: NewCourse) => {
    await postNewCourse(newCourse)
    await refetchOrgCourses()
    await refetchOrgActiveCourses()
    setNewCourseFormOpen(false)
  }

  return (
    // Removing frontPageUrl for some unsolved reason returns to organization front page rather than root
    <Layout frontPageUrl="/">
      <div className={wideWidthCenteredComponentStyles}>
        <h1>Organization courses</h1>
        <OrganizationImageWidget
          organization={dataOrg}
          onOrganizationUpdated={() => refetchOrg()}
        />
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {dataOrgCourses.map((course) => (
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
                  </Link>
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
              <NewCourseForm organizationId={query.id} onSubmitForm={handleSubmitNewCourse} />
            </div>
          </Dialog>
        </div>
        <h1>Active courses</h1>
        {dataOrgActiveCourses.length === 0 ? (
          <p> No active courses </p>
        ) : (
          dataOrgActiveCourses.map((course) => (
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
          ))
        )}
        {loginStateContext.signedIn && (
          <>
            <Button
              size="medium"
              variant="primary"
              onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}
            >
              Add course
            </Button>
            <br />
            <br />
          </>
        )}
        <DebugModal data={dataOrgCourses} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))

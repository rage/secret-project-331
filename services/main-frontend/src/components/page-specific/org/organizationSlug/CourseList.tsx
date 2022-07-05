import { css } from "@emotion/css"
import { Box, Dialog, Pagination } from "@mui/material"
import { useRouter } from "next/router"
import { useContext, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { postNewCourse, postNewCourseDuplicate } from "../../../../services/backend/courses"
import {
  fetchOrganizationCourseCount,
  fetchOrganizationCourses,
} from "../../../../services/backend/organizations"
import { NewCourse } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import OnlyRenderIfPermissions from "../../../../shared-module/components/OnlyRenderIfPermissions"
import Spinner from "../../../../shared-module/components/Spinner"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import useAuthorizeMultiple from "../../../../shared-module/hooks/useAuthorizeMultiple"
import NewCourseForm from "../../../forms/NewCourseForm"

import { CourseComponent, CourseGrid } from "./CourseCard"

interface Props {
  organizationId: string
  organizationSlug: string
  perPage: number
}

const CourseList: React.FC<Props> = ({ organizationId, organizationSlug, perPage }) => {
  const { t } = useTranslation()
  const router = useRouter()

  let initialPage: number
  if (typeof router.query.page === "string") {
    initialPage = parseInt(router.query.page)
  } else {
    initialPage = 1
  }
  const [page, setPage] = useState(initialPage)

  const getOrgCourses = useQuery(
    [`organization-courses`, page, perPage],
    () => {
      if (organizationId) {
        return fetchOrganizationCourses(organizationId, page, perPage)
      } else {
        // This should never happen, used for typescript because enabled boolean doesn't do type checking
        return Promise.reject(new Error("Organization ID undefined"))
      }
    },
    { enabled: !!organizationId },
  )

  const getOrgCourseCount = useQuery(
    [`organization-courses-count`, organizationSlug],
    () => {
      if (organizationId) {
        return fetchOrganizationCourseCount(organizationId)
      } else {
        // This should never happen, used for typescript because enabled boolean doesn't do type checking
        return Promise.reject(new Error("Organization ID undefined"))
      }
    },
    { enabled: !!organizationId },
  )

  const canMangeCourse = useAuthorizeMultiple(
    getOrgCourses.data?.map((course) => {
      // eslint-disable-next-line i18next/no-literal-string
      return { action: { type: "teach" }, resource: { type: "course", id: course.id } }
    }) ?? [],
  )

  const loginStateContext = useContext(LoginStateContext)

  const [newCourseFormOpen, setNewCourseFormOpen] = useState(false)

  const handleSubmitNewCourse = async (newCourse: NewCourse) => {
    await postNewCourse(newCourse)
    await getOrgCourses.refetch()
    await getOrgCourseCount.refetch()
    setNewCourseFormOpen(!newCourseFormOpen)
  }

  const handleSubmitDuplicateCourse = async (oldCourseId: string, newCourse: NewCourse) => {
    await postNewCourseDuplicate(oldCourseId, newCourse)
    await getOrgCourses.refetch()
    await getOrgCourseCount.refetch()
    setNewCourseFormOpen(!newCourseFormOpen)
  }

  if (getOrgCourses.isError) {
    return <ErrorBanner variant={"readOnly"} error={getOrgCourses.error} />
  }

  if (getOrgCourseCount.isError) {
    return <ErrorBanner variant={"readOnly"} error={getOrgCourseCount.error} />
  }

  if (
    getOrgCourses.isLoading ||
    getOrgCourses.isIdle ||
    getOrgCourseCount.isLoading ||
    getOrgCourseCount.isIdle
  ) {
    return <Spinner variant={"medium"} />
  }

  const courseCount = getOrgCourseCount.data.count
  if (courseCount <= 0) {
    return <div>{t("no-courses-in-org")}</div>
  }
  const pageCount = Math.ceil(courseCount / perPage)
  if (page > pageCount) {
    setPage(pageCount)
  }

  const courses = getOrgCourses.data.map((course, n) => {
    return (
      <CourseComponent
        key={course.id}
        title={course.name}
        isDraft={course.is_draft}
        description={course.description ?? t("no-description-available")}
        languageCode={course.language_code}
        // eslint-disable-next-line i18next/no-literal-string
        manageHref={`/manage/courses/${course.id}`}
        // eslint-disable-next-line i18next/no-literal-string
        navigateToCourseHref={`/org/${organizationSlug}/courses/${course.slug}`}
        id={course.id}
        showManageButton={canMangeCourse.data?.[n] === true}
      />
    )
  })

  return (
    <div>
      <CourseGrid>{courses}</CourseGrid>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Box my={2} display="flex" justifyContent="center">
        <Pagination
          count={Math.ceil(Number(courseCount) / perPage)}
          page={page}
          onChange={async (_, pageNumber) => {
            router.replace(
              {
                query: {
                  ...router.query,
                  page: pageNumber,
                },
              },
              undefined,
              { shallow: true },
            )
            setPage(pageNumber)
          }}
        />
      </Box>
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
              {t("button-text-close")}
            </Button>
            <NewCourseForm
              organizationId={organizationId}
              courses={getOrgCourses.data}
              onSubmitNewCourseForm={handleSubmitNewCourse}
              onSubmitDuplicateCourseForm={handleSubmitDuplicateCourse}
              onClose={() => setNewCourseFormOpen(!newCourseFormOpen)}
            />
          </div>
        </Dialog>
      </div>

      <br />
      {loginStateContext.signedIn && (
        <OnlyRenderIfPermissions
          action={{ type: "create_courses_or_exams" }}
          resource={{ id: organizationId, type: "organization" }}
        >
          <Button
            size="medium"
            variant="primary"
            onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}
          >
            {t("button-text-create")}
          </Button>
        </OnlyRenderIfPermissions>
      )}
    </div>
  )
}

export default CourseList

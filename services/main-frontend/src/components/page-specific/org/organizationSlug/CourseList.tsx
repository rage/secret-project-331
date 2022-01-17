import { css } from "@emotion/css"
import { Box, Dialog, Pagination } from "@material-ui/core"
import { useRouter } from "next/router"
import { useContext, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { postNewCourse } from "../../../../services/backend/courses"
import {
  fetchOrganizationCourseCount,
  fetchOrganizationCourses,
} from "../../../../services/backend/organizations"
import { NewCourse } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"

import { CourseComponent, CourseGrid } from "./CourseCard"
import NewCourseForm from "./NewCourseForm"

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
    () => fetchOrganizationCourses(organizationId, page, perPage),
    { enabled: !!organizationId },
  )

  const getOrgCourseCount = useQuery(
    [`organization-courses-count`, organizationSlug],
    () => fetchOrganizationCourseCount(organizationId),
    { enabled: !!organizationId },
  )

  const loginStateContext = useContext(LoginStateContext)

  const [newCourseFormOpen, setNewCourseFormOpen] = useState(false)

  const handleSubmitNewCourse = async (newCourse: NewCourse) => {
    await postNewCourse(newCourse)
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

  const courses = getOrgCourses.data.map((course) => (
    <CourseComponent
      key={course.id}
      title={course.name}
      description={course.description ?? t("no-description-available")}
      languageCode={course.language_code}
      // eslint-disable-next-line i18next/no-literal-string
      manageHref={`/manage/courses/${course.id}`}
      // eslint-disable-next-line i18next/no-literal-string
      navigateToCourseHref={`/org/${organizationSlug}/courses/${course.slug}`}
    />
  ))

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
            <NewCourseForm organizationId={organizationId} onSubmitForm={handleSubmitNewCourse} />
          </div>
        </Dialog>
      </div>

      <br />
      {loginStateContext.signedIn && (
        <>
          <Button
            size="medium"
            variant="primary"
            onClick={() => setNewCourseFormOpen(!newCourseFormOpen)}
          >
            {t("button-text-create")}
          </Button>
          <br />
          <br />
        </>
      )}
    </div>
  )
}

export default CourseList

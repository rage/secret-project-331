import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import { postNewCourse, postNewCourseDuplicate } from "../../../../services/backend/courses"
import {
  fetchOrganizationCourseCount,
  fetchOrganizationCourses,
} from "../../../../services/backend/organizations"
import { NewCourse } from "../../../../shared-module/common/bindings"
import Button from "../../../../shared-module/common/components/Button"
import Dialog from "../../../../shared-module/common/components/Dialog"
import ErrorBanner from "../../../../shared-module/common/components/ErrorBanner"
import OnlyRenderIfPermissions from "../../../../shared-module/common/components/OnlyRenderIfPermissions"
import Pagination from "../../../../shared-module/common/components/Pagination"
import Spinner from "../../../../shared-module/common/components/Spinner"
import LoginStateContext from "../../../../shared-module/common/contexts/LoginStateContext"
import useAuthorizeMultiple from "../../../../shared-module/common/hooks/useAuthorizeMultiple"
import usePaginationInfo from "../../../../shared-module/common/hooks/usePaginationInfo"
import NewCourseForm from "../../../forms/NewCourseForm"

import { CourseComponent, CourseGrid } from "./CourseCard"

interface Props {
  organizationId: string
  organizationSlug: string
}

const CourseList: React.FC<React.PropsWithChildren<Props>> = ({
  organizationId,
  organizationSlug,
}) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const getOrgCourses = useQuery({
    queryKey: [`organization-courses`, paginationInfo.page, paginationInfo.limit, organizationId],
    queryFn: () => {
      if (organizationId) {
        return fetchOrganizationCourses(organizationId, paginationInfo.page, paginationInfo.limit)
      } else {
        // This should never happen, used for typescript because enabled boolean doesn't do type checking
        return Promise.reject(new Error("Organization ID undefined"))
      }
    },
    enabled: !!organizationId,
  })

  const getOrgCourseCount = useQuery({
    queryKey: [`organization-courses-count`, organizationSlug, organizationId],
    queryFn: () => {
      if (organizationId) {
        return fetchOrganizationCourseCount(organizationId)
      } else {
        // This should never happen, used for typescript because enabled boolean doesn't do type checking
        return Promise.reject(new Error("Organization ID undefined"))
      }
    },
    enabled: !!organizationId,
  })

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
    return <ErrorBanner error={getOrgCourses.error} />
  }

  if (getOrgCourseCount.isError) {
    return <ErrorBanner error={getOrgCourseCount.error} />
  }

  if (getOrgCourses.isPending || getOrgCourseCount.isPending) {
    return <Spinner variant={"medium"} />
  }

  const courseCount = getOrgCourseCount.data.count

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
      {courseCount <= 0 && <p>{t("no-courses-in-org")}</p>}
      {courseCount > 0 && <CourseGrid>{courses}</CourseGrid>}
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <div
        className={css`
          display: flex;
          justify-content: center;
        `}
      >
        <Pagination
          totalPages={Math.ceil(Math.max(courseCount, 1) / paginationInfo.limit)}
          paginationInfo={paginationInfo}
        />
      </div>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <Dialog open={newCourseFormOpen} noPadding>
          <div
            className={css`
              margin: 1rem;
              padding: 1rem;
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

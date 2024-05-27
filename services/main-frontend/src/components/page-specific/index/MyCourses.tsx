import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import useAllOrganizationsQuery from "../../../hooks/useAllOrganizationsQuery"
import { getMyCourses } from "../../../services/backend/users"
import { CourseComponent, CourseGrid } from "../org/organizationSlug/CourseCard"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"

const MyCourses: React.FC = () => {
  const { t } = useTranslation()
  const myCoursesQuery = useQuery({
    queryKey: ["my-courses"],
    queryFn: () => getMyCourses(),
  })
  const allOrganizationsQuery = useAllOrganizationsQuery()
  const canMangeCourse = useAuthorizeMultiple(
    myCoursesQuery.data?.map((course) => {
      // eslint-disable-next-line i18next/no-literal-string
      return { action: { type: "teach" }, resource: { type: "course", id: course.id } }
    }) ?? [],
  )
  if (myCoursesQuery.isError || allOrganizationsQuery.isError) {
    return (
      <ErrorBanner error={myCoursesQuery.error ?? allOrganizationsQuery.error} variant="readOnly" />
    )
  }

  if (myCoursesQuery.isLoading || allOrganizationsQuery.isLoading) {
    return <Spinner variant="medium" />
  }

  return (
    <CourseGrid>
      {myCoursesQuery.data?.map((course, n) => {
        const organization = allOrganizationsQuery.data?.find(
          (org) => org.id === course.organization_id,
        )
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
            navigateToCourseHref={`/org/${organization?.slug ?? "undefined"}/courses/${
              course.slug
            }`}
            id={course.id}
            showManageButton={canMangeCourse.data?.[n] === true}
          />
        )
      })}
    </CourseGrid>
  )
}

export default MyCourses

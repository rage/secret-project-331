"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import CourseCard, { CourseGrid } from "@/app/org/[organizationSlug]/CourseCard"
import {
  getMyCoursesOptions,
  getMyCoursesQueryKey,
  hideCourseFromMyCoursesMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import useAllOrganizationsQuery from "@/hooks/useAllOrganizationsQuery"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { manageCourseByIdRoute, navigateToCourseRoute } from "@/shared-module/common/utils/routes"
import { QueryResults } from "@/shared-module/components"

const MyCourses: React.FC = () => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const queryClient = useQueryClient()
  const myCoursesQuery = useQuery({
    ...getMyCoursesOptions(),
  })
  const hideCourseMutation = useToastMutationOptions(
    hideCourseFromMyCoursesMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getMyCoursesQueryKey() })
      },
    },
  )
  const handleHideCourse = async (courseId: string, courseName: string) => {
    const confirmed = await confirm(
      t("hide-course-confirmation-message", { name: courseName }),
      t("hide-course-confirmation-title"),
    )
    if (confirmed) {
      hideCourseMutation.mutate({ path: { course_id: courseId } })
    }
  }
  const allOrganizationsQuery = useAllOrganizationsQuery()
  const canMangeCourse = useAuthorizeMultiple(
    myCoursesQuery.data?.map((course) => {
      return { action: { type: "teach" }, resource: { type: "course", id: course.id } }
    }) ?? [],
  )
  return (
    <QueryResults
      queries={[myCoursesQuery, allOrganizationsQuery] as const}
      treatEmptyAsData
      renderData={([myCourses, allOrganizations]) => (
        <CourseGrid>
          {myCourses.map((course, n) => {
            const organization = allOrganizations.find((org) => org.id === course.organization_id)
            return (
              <CourseCard
                key={course.id}
                title={course.name}
                isDraft={course.is_draft}
                isUnlisted={course.is_unlisted}
                description={course.description ?? t("no-description-available")}
                languageCode={course.language_code}
                manageHref={manageCourseByIdRoute(course.id)}
                navigateToCourseHref={navigateToCourseRoute(
                  // oxlint-disable-next-line i18next/no-literal-string
                  organization?.slug || "undefined",
                  course.slug,
                )}
                id={course.id}
                showManageButton={canMangeCourse.data?.[n] === true}
                onHide={() => handleHideCourse(course.id, course.name)}
              />
            )
          })}
        </CourseGrid>
      )}
    />
  )
}

export default MyCourses

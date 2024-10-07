import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import {
  addUserToCourseWithJoinCode,
  fetchCourseWithJoinCode,
  getCourseBreadCrumbInfo,
} from "@/services/backend/courses"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

const JoinCoursePage: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const joinCode = useQueryParameter("code")

  const course = useQuery({
    queryKey: [`/courses/join/${joinCode}/`, joinCode],
    queryFn: () => fetchCourseWithJoinCode(joinCode ?? ""),
  })

  const courseId = course.data?.id

  const courseBreadcrumbs = useQuery({
    queryKey: [`/courses/${courseId}/breadcrumb-info`, courseId],
    queryFn: () => getCourseBreadCrumbInfo(courseId ?? ""),
    enabled: !!courseId,
  })

  const handleRedirectMutation = useToastMutation(
    async (courseId: string) => {
      await addUserToCourseWithJoinCode(courseId)
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        courseBreadcrumbs.refetch()
        if (courseBreadcrumbs.isSuccess) {
          // eslint-disable-next-line i18next/no-literal-string
          location.href = `/org/${courseBreadcrumbs.data.organization_slug}/courses/${courseBreadcrumbs.data?.course_slug}`
        }
      },
    },
  )

  const handleReturn = () => {
    if (courseBreadcrumbs.isSuccess) {
      location.href = `/`
    }
  }
  return (
    <div>
      {course.isError && <ErrorBanner variant={"readOnly"} error={courseBreadcrumbs.error} />}
      {course.isPending && <Spinner variant={"medium"} />}
      {course.isSuccess && (
        <div>
          <h1>{course.data.name}</h1>

          <div>{t("do-you-want-to-join-this-course")}</div>
          <Button
            variant={"primary"}
            size={"small"}
            onClick={() => handleRedirectMutation.mutate(course.data?.id)}
          >
            {t("button-text-enroll-me")}{" "}
          </Button>
          <Button variant={"secondary"} size={"small"} onClick={handleReturn}>
            {t("button-text-cancel")}
          </Button>
        </div>
      )}
    </div>
  )
}

export default JoinCoursePage

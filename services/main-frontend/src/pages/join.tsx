import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { addUserToCourseWithJoinCode } from "@/services/backend/course-instances"
import {
  fetchCourseInstanceWithJoinCode,
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

  const courseInstance = useQuery({
    queryKey: [`/course-instances/join/${joinCode}/`, joinCode],
    queryFn: () => fetchCourseInstanceWithJoinCode(joinCode ?? ""),
  })

  const courseId = courseInstance.data?.course_id

  const courseBreadcrumbs = useQuery({
    queryKey: [`/courses/${courseId}/breadcrumb-info`, courseId],
    queryFn: () => getCourseBreadCrumbInfo(courseId ?? ""),
    enabled: !!courseId,
  })

  const handleRedirectMutation = useToastMutation(
    async (courseInstanceId: string) => {
      await addUserToCourseWithJoinCode(courseInstanceId)
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
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
      {courseInstance.isError && (
        <ErrorBanner variant={"readOnly"} error={courseBreadcrumbs.error} />
      )}
      {courseInstance.isPending && <Spinner variant={"medium"} />}
      {courseInstance.isSuccess && courseBreadcrumbs.isSuccess && (
        <div>
          <h1>{courseBreadcrumbs.data?.course_name}</h1>

          <div>{t("do-you-want-to-join-this-course")}</div>
          <Button
            variant={"primary"}
            size={"small"}
            onClick={() => handleRedirectMutation.mutate(courseInstance.data?.id)}
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

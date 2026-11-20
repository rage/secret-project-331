import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { getCourseInstanceOptions } from "@/generated/api/@tanstack/react-query.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"

/** Titles a course instance sub-page "<section> - <instance name>", overriding the layout's. */
export function useCourseInstancePageTitle(courseInstanceId: string, section: string): void {
  const { t } = useTranslation()
  const instanceQuery = useQuery(
    getCourseInstanceOptions({ path: { course_instance_id: courseInstanceId } }),
  )
  usePageTitle(
    instanceQuery.isLoading
      ? null
      : joinTitleSegments([section, instanceQuery.data?.name || t("default-instance")]),
    { order: 10 },
  )
}

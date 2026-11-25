"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { ADMIN_MODE } from "@/components/language-versions/constants"
import { LanguageVersionTool } from "@/components/language-versions/LanguageVersionTool"
import { getAllCoursesOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { Course } from "@/generated/api/types.generated"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { manageLanguageVersionsRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { ComboBox, ErrorNotice } from "@/shared-module/components"

interface CourseFields {
  course_id: string | null
}

const pageCss = css`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-top: 2rem;

  h1 {
    margin: 0;
    font-size: clamp(2rem, 3.6vh, 36px);
    font-weight: 700;
    color: var(--color-gray-700);
  }
`

const leadCss = css`
  margin: -1rem 0 0;
  color: var(--color-gray-600);
`

const courseLabel = (course: Course) => `${course.name} (${course.slug})`

function LanguageVersionsAdminPage() {
  const { t } = useTranslation()
  usePageTitle(t("link-language-versions"))
  const router = useRouter()
  const courseId = useSearchParams().get("course")
  const courses = useQuery(getAllCoursesOptions())

  const { control, watch, setValue } = useForm<CourseFields>({
    defaultValues: { course_id: courseId },
  })
  const pickedCourseId = watch("course_id")

  useEffect(() => {
    if (pickedCourseId && pickedCourseId !== courseId) {
      router.replace(manageLanguageVersionsRoute(pickedCourseId))
    }
  }, [pickedCourseId, courseId, router])

  // Back/forward changes the URL without touching the form.
  useEffect(() => {
    setValue("course_id", courseId)
  }, [courseId, setValue])

  return (
    <OnlyRenderIfPermissions
      action={{ type: "edit" }}
      resource={{ type: "global_permissions" }}
      elseRender={<ErrorNotice error={new Error(t("language-versions-admin-forbidden"))} />}
    >
      <div className={pageCss}>
        <h1>{t("link-language-versions")}</h1>
        <p className={leadCss}>{t("language-versions-admin-lead")}</p>
        {courses.isError && (
          <ErrorNotice error={courses.error} context={t("language-versions-courses-failed")} />
        )}
        <ComboBox
          name="course_id"
          control={control}
          label={t("language-versions-course-search-label")}
          items={courses.data ?? []}
          getItemKey={(course) => course.id}
          getItemTextValue={courseLabel}
          isDisabled={courses.isPending}
        >
          {courseLabel}
        </ComboBox>
        {courseId && <LanguageVersionTool courseId={courseId} mode={ADMIN_MODE} />}
      </div>
    </OnlyRenderIfPermissions>
  )
}

export default withErrorBoundary(withSignedIn(LanguageVersionsAdminPage))

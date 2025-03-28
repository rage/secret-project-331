import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { useCourseModuleCompletions } from "@/hooks/useCourseModuleCompletions"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Accordion from "@/shared-module/common/components/Accordion"
import BooleanAsText from "@/shared-module/common/components/BooleanAsText"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { dateToString } from "@/shared-module/common/utils/time"

const Section = styled.section`
  margin: 2rem 0;
`

interface CourseModuleCompletionsSectionProps {
  courseInstanceId: string
  userId: string
  courseId: string
}

const CourseModuleCompletionsSection: React.FC<CourseModuleCompletionsSectionProps> = ({
  courseInstanceId,
  userId,
  courseId,
}) => {
  const { t } = useTranslation()
  const courseModuleCompletionsQuery = useCourseModuleCompletions(courseInstanceId, userId)

  const courseStructure = useCourseStructure(courseId)

  if (courseModuleCompletionsQuery.isError || courseStructure.isError) {
    return <ErrorBanner error={courseModuleCompletionsQuery.error ?? courseStructure.error} />
  }

  if (courseModuleCompletionsQuery.isLoading || courseStructure.isLoading) {
    return <Spinner />
  }

  if (!courseStructure.data) {
    return <ErrorBanner error={new Error("Course structure not found")} />
  }

  return (
    <Section>
      <h2
        className={css`
          margin-bottom: 0.5rem;
        `}
      >
        {t("label-course-module-completions")}
      </h2>
      {courseModuleCompletionsQuery.data?.length === 0 && <p>{t("no-data")}</p>}
      {courseModuleCompletionsQuery.data?.map((courseModuleCompletion) => {
        const courseModule = courseStructure.data.modules.find(
          (cm) => cm.id === courseModuleCompletion.course_module_id,
        )
        return (
          <Accordion
            key={courseModuleCompletion.id}
            className={css`
              margin-bottom: 1rem;
            `}
          >
            <details>
              <summary>
                {courseModule?.name ?? t("default-module")}{" "}
                <HideTextInSystemTests
                  text={dateToString(courseModuleCompletion.completion_date)}
                  testPlaceholder={dateToString(new Date(0))}
                />
              </summary>
              <div>
                <p>
                  {t("label-course-module")}: {courseModule?.name ?? t("default-module")}{" "}
                  {courseModule?.uh_course_code && `(${courseModule.uh_course_code})`}
                </p>
                <p>
                  {t("label-passed")}: <BooleanAsText value={courseModuleCompletion.passed} />
                </p>
                <p>
                  {t("label-grade")}: {courseModuleCompletion.grade}
                </p>
                <p>
                  {t("label-prerequisite-modules-completed")}:{" "}
                  <BooleanAsText value={courseModuleCompletion.prerequisite_modules_completed} />
                </p>
                <p>
                  {t("label-completion-language")}: {courseModuleCompletion.completion_language}
                </p>
                <p>
                  {t("label-created-at")}: {dateToString(courseModuleCompletion.created_at)}
                </p>
                <p>
                  {t("label-completion-date-short")}:{" "}
                  {dateToString(courseModuleCompletion.completion_date)}
                </p>
                <p>
                  {t("label-completion-registration-attempt-date")}:{" "}
                  {courseModuleCompletion.completion_registration_attempt_date
                    ? dateToString(courseModuleCompletion.completion_registration_attempt_date)
                    : t("label-null")}
                </p>
                {courseModuleCompletion.completion_granter_user_id && (
                  <p>
                    {t("label-completion-granter-user-id")}:{" "}
                    {courseModuleCompletion.completion_granter_user_id}
                  </p>
                )}
                <DebugModal data={courseModuleCompletion} />
              </div>
            </details>
          </Accordion>
        )
      })}
    </Section>
  )
}

export default CourseModuleCompletionsSection

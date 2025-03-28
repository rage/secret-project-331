import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { useCourseModuleCompletions } from "@/hooks/useCourseModuleCompletions"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import BooleanAsText from "@/shared-module/common/components/BooleanAsText"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { baseTheme } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"

const Section = styled.section`
  margin: 2rem 0;
`

const ModuleCard = styled.div`
  background: ${baseTheme.colors.clear[100]};
  border: 1px solid ${baseTheme.colors.clear[200]};
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.05);
`

const ModuleHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid ${baseTheme.colors.clear[200]};
`

const ModuleTitle = styled.h3`
  margin: 0;
  color: ${baseTheme.colors.gray[700]};
  font-size: 1.125rem;
`

const CompletionDate = styled.span`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.875rem;
`

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15.625rem, 1fr));
  gap: 1rem;
`

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`

const Label = styled.span`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.875rem;
`

const Value = styled.span`
  color: ${baseTheme.colors.gray[700]};
  font-size: 1rem;
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
          margin-bottom: 1.5rem;
          color: ${baseTheme.colors.gray[700]};
          font-size: 1.5rem;
        `}
      >
        {t("label-course-module-completions")}
      </h2>
      {courseModuleCompletionsQuery.data?.length === 0 && (
        <p
          className={css`
            color: ${baseTheme.colors.gray[500]};
            font-size: 1rem;
          `}
        >
          {t("no-data")}
        </p>
      )}
      {courseModuleCompletionsQuery.data?.map((courseModuleCompletion) => {
        const courseModule = courseStructure.data.modules.find(
          (cm) => cm.id === courseModuleCompletion.course_module_id,
        )
        return (
          <ModuleCard key={courseModuleCompletion.id}>
            <ModuleHeader>
              <ModuleTitle>
                {courseModule?.name ?? t("default-module")}
                {courseModule?.uh_course_code && ` (${courseModule.uh_course_code})`}
              </ModuleTitle>
              <CompletionDate>
                <HideTextInSystemTests
                  text={dateToString(courseModuleCompletion.completion_date)}
                  testPlaceholder={dateToString(new Date(0))}
                />
              </CompletionDate>
            </ModuleHeader>
            <InfoGrid>
              <InfoItem>
                <Label>{t("label-passed")}</Label>
                <Value>
                  <BooleanAsText value={courseModuleCompletion.passed} />
                </Value>
              </InfoItem>
              <InfoItem>
                <Label>{t("label-grade")}</Label>
                <Value>{courseModuleCompletion.grade}</Value>
              </InfoItem>
              <InfoItem>
                <Label>{t("label-prerequisite-modules-completed")}</Label>
                <Value>
                  <BooleanAsText value={courseModuleCompletion.prerequisite_modules_completed} />
                </Value>
              </InfoItem>
              <InfoItem>
                <Label>{t("label-completion-language")}</Label>
                <Value>{courseModuleCompletion.completion_language}</Value>
              </InfoItem>
              <InfoItem>
                <Label>{t("label-created-at")}</Label>
                <Value>{dateToString(courseModuleCompletion.created_at)}</Value>
              </InfoItem>
              <InfoItem>
                <Label>{t("label-completion-registration-attempt-date")}</Label>
                <Value>
                  {courseModuleCompletion.completion_registration_attempt_date
                    ? dateToString(courseModuleCompletion.completion_registration_attempt_date)
                    : t("label-null")}
                </Value>
              </InfoItem>
              {courseModuleCompletion.completion_granter_user_id && (
                <InfoItem>
                  <Label>{t("label-completion-granter-user-id")}</Label>
                  <Value>{courseModuleCompletion.completion_granter_user_id}</Value>
                </InfoItem>
              )}
            </InfoGrid>
            <div
              className={css`
                margin-top: 1rem;
                display: flex;
                justify-content: flex-end;
              `}
            >
              <DebugModal data={courseModuleCompletion} />
            </div>
          </ModuleCard>
        )
      })}
    </Section>
  )
}

export default CourseModuleCompletionsSection

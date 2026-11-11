"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import { useTranslation } from "react-i18next"

import { useCourseEndQuestionsWithAnswers } from "@/hooks/useCourseEndQuestionsWithAnswers"
import { useCourseInstanceProgress } from "@/hooks/useCourseInstanceProgress"
import { useCourseModuleCompletions } from "@/hooks/useCourseModuleCompletions"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import BooleanAsYesOrNoText from "@/shared-module/common/components/BooleanAsYesOrNoText"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { baseTheme } from "@/shared-module/common/styles"
import { QueryResults } from "@/shared-module/components"

import EndQuestionAnswerChip from "./EndQuestionAnswersAccordion"

const Section = styled.section`
  margin: 2rem 0;
`

const ModuleCard = styled.div`
  background: white;
  border: 1px solid ${baseTheme.colors.clear[200]};
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.05);
`

const ModuleHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${baseTheme.colors.clear[200]};
`

const ModuleTitle = styled.h3`
  margin: 0;
  color: ${baseTheme.colors.gray[700]};
  font-size: 1.25rem;
  font-weight: 600;
`

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15.625rem, 1fr));
  gap: 1.5rem;
`

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: ${baseTheme.colors.clear[100]};
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.clear[200]};
`

const Label = styled.span`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.875rem;
  font-weight: 500;
`

const Value = styled.span`
  color: ${baseTheme.colors.gray[700]};
  font-size: 1.125rem;
  font-weight: 600;
`

const lol = css`
  display: flex;
  justify-content: space-between;
`

const ProgressBar = styled.div`
  width: 100%;
  height: 0.5rem;
  background: ${baseTheme.colors.clear[300]};
  border-radius: 0.25rem;
  overflow: hidden;
  margin-top: 0.5rem;
`

const ProgressDone = styled.div<{ progress: number }>`
  height: 0.5rem;
  position: relative;
  top: -0.5rem;
  width: ${(props) => props.progress}%;
  background: ${(props) =>
    props.progress >= 100
      ? baseTheme.colors.green[500]
      : props.progress >= 50
        ? baseTheme.colors.green[400]
        : baseTheme.colors.green[300]};
  transition: width 0.3s ease;
`

const ProgressRequired = styled.div<{ required: number }>`
  height: 0.5rem;
  position: relative;
  width: ${(props) => props.required}%;
  background: ${baseTheme.colors.yellow[200]};
  transition: width 0.3s ease;
`

const ProgressValue = styled.span`
  color: ${baseTheme.colors.gray[700]};
  font-size: 0.875rem;
  font-weight: 500;
`

const iconStyle = css`
  position: absolute;
  margin: 0.25rem;
  margin-left: 0.5rem;
`

interface CourseInstanceProgressSectionProps {
  userId: string
  courseId: string
}

const CourseInstanceProgressSection: React.FC<CourseInstanceProgressSectionProps> = ({
  userId,
  courseId,
}) => {
  const { t } = useTranslation()
  const courseStructure = useCourseStructure(courseId)
  const courseInstanceProgresses = useCourseInstanceProgress(courseId, userId)
  const courseModuleCompletions = useCourseModuleCompletions(courseId, userId)
  const endQuestionsWithAnswers = useCourseEndQuestionsWithAnswers(courseId, userId)

  const heading = (
    <h2
      className={css`
        margin-bottom: 1.5rem;
        color: ${baseTheme.colors.gray[700]};
        font-size: 1.75rem;
        font-weight: 600;
      `}
    >
      {t("label-progressing")}
    </h2>
  )

  return (
    <QueryResults
      queries={[courseInstanceProgresses, courseStructure] as const}
      emptyFallback={
        <Section>
          {heading}
          <p
            className={css`
              color: ${baseTheme.colors.gray[500]};
              font-size: 1rem;
              padding: 1.5rem;
              background: ${baseTheme.colors.clear[100]};
              border: 1px solid ${baseTheme.colors.clear[200]};
              border-radius: 0.5rem;
              text-align: center;
            `}
          >
            {t("no-data")}
          </p>
        </Section>
      }
      renderData={([courseInstanceProgressesData, courseStructureData]) => {
        if (!courseStructureData) {
          return <ErrorBanner error={new Error("Course structure not found")} />
        }

        const isSingleModule = courseInstanceProgressesData.length === 1

        return (
          <Section>
            {heading}
            {courseInstanceProgressesData.map((courseInstanceProgress) => {
              const courseModule = courseStructureData.modules.find(
                (cm) => cm.id === courseInstanceProgress.course_module_id,
              )
              const moduleName = courseModule?.name ?? t("default-module")
              const pointsProgress = courseInstanceProgress.score_maximum
                ? (courseInstanceProgress.score_given / courseInstanceProgress.score_maximum) * 100
                : 0
              const pointsRequired = courseInstanceProgress.score_required
                ? (courseInstanceProgress.score_required /
                    (courseInstanceProgress.score_maximum ??
                      courseInstanceProgress.score_required)) *
                  100
                : 0
              const exercisesProgress = courseInstanceProgress.total_exercises
                ? ((courseInstanceProgress.attempted_exercises ?? 0) /
                    courseInstanceProgress.total_exercises) *
                  100
                : 0
              const exercisesRequired = courseInstanceProgress.attempted_exercises_required
                ? (courseInstanceProgress.attempted_exercises_required /
                    (courseInstanceProgress.total_exercises ??
                      courseInstanceProgress.attempted_exercises_required)) *
                  100
                : 0
              const completionData = courseModuleCompletions.data?.find((x) => {
                return x.course_module_id === courseModule?.id
              })
              const suspectedCheating = completionData?.needs_to_be_reviewed ?? false
              const endAnswers = endQuestionsWithAnswers.data
                ?.filter((x) => (x.course_module_id = courseInstanceProgress.course_module_id))
                .toSorted((y, z) => y.question_serial_number - z.question_serial_number)
              return (
                <ModuleCard key={courseInstanceProgress.course_module_id}>
                  <ModuleHeader>
                    {!isSingleModule && <ModuleTitle>{moduleName}</ModuleTitle>}
                    <DebugModal data={courseInstanceProgress} variant="minimal" />
                  </ModuleHeader>
                  <InfoGrid>
                    <InfoItem>
                      <Label>{t("module-has-been-completed")}</Label>
                      <Value>
                        <BooleanAsYesOrNoText value={courseInstanceProgress.completion_attained} />
                      </Value>
                    </InfoItem>
                    <InfoItem>
                      <Label className={lol}>
                        <span>{t("label-points")}</span> <span>{t("required")}</span>
                      </Label>
                      <Value className={lol}>
                        <span>
                          {courseInstanceProgress.score_given} /{" "}
                          {courseInstanceProgress.score_maximum ?? 0}{" "}
                        </span>
                        <span>{courseInstanceProgress.score_required ?? 0}</span>
                      </Value>
                      <ProgressBar>
                        <ProgressRequired required={pointsRequired} />
                        <ProgressDone progress={pointsProgress} />
                      </ProgressBar>
                      <ProgressValue>{Math.round(pointsProgress)}%</ProgressValue>
                    </InfoItem>
                    <InfoItem>
                      <Label className={lol}>
                        <span>{t("label-attempted-exercises")}</span> <span>{t("required")}</span>
                      </Label>
                      <Value className={lol}>
                        <span>
                          {courseInstanceProgress.attempted_exercises ?? 0} /{" "}
                          {courseInstanceProgress.total_exercises ?? 0}
                        </span>
                        <span>{courseInstanceProgress.attempted_exercises_required ?? 0}</span>
                      </Value>
                      <ProgressBar>
                        <ProgressRequired required={exercisesRequired} />
                        <ProgressDone progress={exercisesProgress} />
                      </ProgressBar>
                      <ProgressValue>{Math.round(exercisesProgress)}%</ProgressValue>
                    </InfoItem>
                    <InfoItem
                      className={css`
                        ${suspectedCheating && `background-color: ${baseTheme.colors.red[200]};`}
                      `}
                    >
                      <Label
                        className={css`
                          ${suspectedCheating && `color: ${baseTheme.colors.gray[600]};`}
                        `}
                      >
                        {t("suspected-cheating")}
                      </Label>
                      <Value>
                        <BooleanAsYesOrNoText value={suspectedCheating} />
                        {suspectedCheating && (
                          <ExclamationTriangle
                            className={iconStyle}
                            size={18}
                            weight="bold"
                            aria-hidden="true"
                          />
                        )}
                      </Value>
                    </InfoItem>
                    <InfoItem>
                      <Label>{t("end-questions-answered")}</Label>
                      <Value>
                        {courseInstanceProgress.requires_ending_questionnaire ? (
                          <BooleanAsYesOrNoText
                            value={courseInstanceProgress.ending_questionnaire_answered}
                          />
                        ) : (
                          t("not-required")
                        )}
                      </Value>
                    </InfoItem>
                  </InfoGrid>
                  {courseInstanceProgress.requires_ending_questionnaire &&
                    courseInstanceProgress.ending_questionnaire_answered &&
                    endAnswers && (
                      <EndQuestionAnswerChip endAnswers={endAnswers} moduleName={moduleName} />
                    )}
                </ModuleCard>
              )
            })}
          </Section>
        )
      }}
    />
  )
}

export default CourseInstanceProgressSection

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useTranslation } from "react-i18next"

import { useCourseInstanceProgress } from "@/hooks/useCourseInstanceProgress"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import Accordion from "@/shared-module/common/components/Accordion"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

const Section = styled.section`
  margin: 2rem 0;
`

interface CourseInstanceProgressSectionProps {
  courseInstanceId: string
  userId: string
  courseId: string
}

const CourseInstanceProgressSection: React.FC<CourseInstanceProgressSectionProps> = ({
  courseInstanceId,
  userId,
  courseId,
}) => {
  const { t } = useTranslation()
  const courseStructure = useCourseStructure(courseId)
  const courseInstanceProgresses = useCourseInstanceProgress(courseInstanceId, userId)

  if (courseInstanceProgresses.isError || courseStructure.isError) {
    return <ErrorBanner error={courseInstanceProgresses.error ?? courseStructure.error} />
  }

  if (courseInstanceProgresses.isLoading || courseStructure.isLoading) {
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
        {t("label-progressing")}
      </h2>
      {courseInstanceProgresses.data?.length === 0 && <p>{t("no-data")}</p>}
      {courseInstanceProgresses.data?.map((courseInstanceProgress) => {
        const courseModule = courseStructure.data.modules.find(
          (cm) => cm.id === courseInstanceProgress.course_module_id,
        )
        return (
          <Accordion
            key={courseInstanceProgress.course_module_id}
            className={css`
              margin-bottom: 1rem;
            `}
          >
            <details>
              <summary>{courseModule?.name ?? t("default-module")}</summary>
              <div>
                {courseInstanceProgress.attempted_exercises_required !== null && (
                  <p>
                    {t("label-attempted-exercises-required")}{" "}
                    {courseInstanceProgress.attempted_exercises_required}
                  </p>
                )}
                {courseInstanceProgress.score_required !== null && (
                  <p>
                    {t("label-points-required")} {courseInstanceProgress.score_required}
                  </p>
                )}
                <p>
                  {t("label-points")}: {courseInstanceProgress.score_given} /{" "}
                  {courseInstanceProgress.score_maximum ?? 0}
                </p>
                <p>
                  {t("label-attempted-exercises")}:{" "}
                  {courseInstanceProgress.attempted_exercises ?? 0} /{" "}
                  {courseInstanceProgress.total_exercises ?? 0}
                </p>
                <DebugModal data={courseInstanceProgress} />
              </div>
            </details>
          </Accordion>
        )
      })}
    </Section>
  )
}

export default CourseInstanceProgressSection

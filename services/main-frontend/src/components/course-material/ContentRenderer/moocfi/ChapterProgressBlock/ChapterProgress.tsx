"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import CircularProgress from "@/components/course-progress/CircularProgress"
import ProgressBar from "@/components/course-progress/ProgressBar"
import { describeProgress, PROGRESS_UNIT } from "@/components/course-progress/progressText"
import { getCourseMaterialChapterProgress } from "@/generated/course-material-api/sdk.generated"
import type { UserCourseInstanceChapterProgress } from "@/generated/course-material-api/types.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { QueryResult } from "@/shared-module/components"

interface ChapterProgressProps {
  chapterId: string
  courseInstanceId: string
}

const ChapterProgress: React.FC<React.PropsWithChildren<ChapterProgressProps>> = ({
  chapterId,
  courseInstanceId,
}) => {
  const { t, i18n } = useTranslation()
  const getUserChapterProgress = useQuery({
    queryKey: [`course-instance-${courseInstanceId}-chapter-${chapterId}-progress`],
    queryFn: (): Promise<UserCourseInstanceChapterProgress> =>
      getCourseMaterialChapterProgress({
        path: {
          chapter_id: chapterId,
          course_instance_id: courseInstanceId,
        },
      }),
  })

  return (
    <div>
      <QueryResult query={getUserChapterProgress}>
        {(data) => {
          const points = { given: data.score_given, max: data.score_maximum, required: null }
          const exercises = {
            given: data.attempted_exercises ?? null,
            max: data.total_exercises ?? null,
            required: null,
          }
          const pointsText = describeProgress(PROGRESS_UNIT.POINTS, points, t, i18n.language, false)
          const exercisesText = describeProgress(
            PROGRESS_UNIT.EXERCISES,
            exercises,
            t,
            i18n.language,
            false,
          )
          return (
            <div
              className={css`
                width: 100%;
                text-align: center;
                padding: 1em 0 2em 0;
                margin: 5em auto;
                background: rgba(242, 245, 247, 0.8);
              `}
            >
              <CircularProgress
                max={data.score_maximum}
                given={data.score_given}
                label={t("chapter-progress")}
                valueText={pointsText.valueText}
                explanations={pointsText.explanations}
              />
              <div
                className={css`
                  padding: 0 2rem;
                  ${respondToOrLarger.md} {
                    padding: 0 6rem;
                  }
                `}
              >
                <ProgressBar
                  exercisesAttempted={exercises.given}
                  exercisesTotal={exercises.max}
                  label={t("exercises-attempted")}
                  valueText={exercisesText.valueText}
                  explanations={exercisesText.explanations}
                />
              </div>
            </div>
          )
        }}
      </QueryResult>
    </div>
  )
}

export default ChapterProgress

"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import ColorsIdentifier from "../CourseProgressBlock/ColorsIdentifier"

import { getCourseMaterialChapterProgress } from "@/generated/course-material-api/sdk.generated"
import type { UserCourseInstanceChapterProgress } from "@/generated/course-material-api/types.generated"
import Progress from "@/shared-module/common/components/CourseProgress"
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
  const { t } = useTranslation()
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
        {(data) => (
          <div
            className={css`
              width: 100%;
              text-align: center;
              padding: 1em 0 2em 0;
              margin: 5em auto;
              background: rgba(242, 245, 247, 0.8);
            `}
          >
            {/* TODO: Verify how it looks when score_given is a floating number */}
            <Progress
              variant="circle"
              max={data.score_maximum}
              given={data.score_given}
              label={t("chapter-progress")}
            />
            <div
              className={css`
                padding: 0 2rem;
                ${respondToOrLarger.md} {
                  padding: 0 6rem;
                }
              `}
            >
              <Progress
                variant={"bar"}
                showAsPercentage={false}
                exercisesAttempted={data.attempted_exercises ?? null}
                exercisesTotal={data.total_exercises ?? null}
                label={t("exercises-attempted")}
              />
              <ColorsIdentifier />
            </div>
          </div>
        )}
      </QueryResult>
    </div>
  )
}

export default ChapterProgress

"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import ProgressCard from "@/components/course-progress/ProgressCard"
import { getCourseMaterialChapterProgress } from "@/generated/course-material-api/sdk.generated"
import type { UserCourseInstanceChapterProgress } from "@/generated/course-material-api/types.generated"
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
              margin: 5em auto;
            `}
          >
            <ProgressCard
              variant="chapter"
              title={t("chapter-progress")}
              headingLevel={3}
              points={{ given: data.score_given, max: data.score_maximum, required: null }}
              exercises={{
                given: data.attempted_exercises ?? null,
                max: data.total_exercises ?? null,
                required: null,
              }}
            />
          </div>
        )}
      </QueryResult>
    </div>
  )
}

export default ChapterProgress

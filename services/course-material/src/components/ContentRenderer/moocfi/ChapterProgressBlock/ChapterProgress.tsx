import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchUserChapterInstanceChapterProgress } from "../../../../services/backend"
import Progress from "../../../../shared-module/components/CourseProgress"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { baseTheme } from "../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"

interface ChapterProgressProps {
  chapterId: string
  courseInstanceId: string
}

const ChapterProgress: React.FC<React.PropsWithChildren<ChapterProgressProps>> = ({
  chapterId,
  courseInstanceId,
}) => {
  const { t } = useTranslation()
  const getUserChapterProgress = useQuery(
    [`course-instance-${courseInstanceId}-chapter-${chapterId}-progress`],
    () => fetchUserChapterInstanceChapterProgress(courseInstanceId, chapterId),
  )

  return (
    <div>
      {getUserChapterProgress.isError && (
        <ErrorBanner variant={"readOnly"} error={getUserChapterProgress.error} />
      )}
      {getUserChapterProgress.isLoading && <Spinner variant={"medium"} />}
      {getUserChapterProgress.isSuccess && (
        <div
          className={css`
            width: 100%;
            text-align: center;
            padding: 2em 0;
            margin: 5em auto;
            background: ${baseTheme.colors.clear[100]};
          `}
        >
          {/* TODO: Verify how it looks when score_given is a floating number */}
          <Progress
            variant="circle"
            max={getUserChapterProgress.data.score_maximum}
            given={getUserChapterProgress.data.score_given}
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
              exercisesAttempted={getUserChapterProgress.data.attempted_exercises}
              exercisesTotal={getUserChapterProgress.data.total_exercises}
              label={t("exercises-attempted")}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ChapterProgress

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchUserChapterInstanceChapterProgress } from "../../../../services/backend"
import Progress from "../../../../shared-module/components/CourseProgress"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { baseTheme } from "../../../../shared-module/styles"

interface ChapterProgressProps {
  chapterId: string
  courseInstanceId: string
}

const ChapterProgress: React.FC<ChapterProgressProps> = ({ chapterId, courseInstanceId }) => {
  const { t } = useTranslation()
  const getUserChapterProgress = useQuery(
    `course-instance-${courseInstanceId}-chapter-${chapterId}-progress`,
    () => fetchUserChapterInstanceChapterProgress(courseInstanceId, chapterId),
  )

  return (
    <div>
      {getUserChapterProgress.isError && (
        <ErrorBanner variant={"readOnly"} error={getUserChapterProgress.error} />
      )}
      {(getUserChapterProgress.isLoading || getUserChapterProgress.isIdle) && (
        <Spinner variant={"medium"} />
      )}
      {getUserChapterProgress.isSuccess && (
        <div
          className={css`
            width: 100%;
            text-align: center;
            padding: 2em 2em 3em 2em;
            margin: 5em auto;
            background: ${baseTheme.colors.clear[100]};
          `}
        >
          {/* TODO: Verify how it looks when score_given is a floating number */}
          <Progress
            variant="circle"
            max={getUserChapterProgress.data.score_maximum}
            given={getUserChapterProgress.data.score_given}
            point={50}
            label={t("chapter-progress")}
          />
          <Progress
            variant={"bar"}
            showAsPercentage={true}
            exercisesAttempted={getUserChapterProgress.data.attempted_exercises}
            exercisesTotal={getUserChapterProgress.data.total_exercises}
          />
        </div>
      )}
    </div>
  )
}

export default ChapterProgress

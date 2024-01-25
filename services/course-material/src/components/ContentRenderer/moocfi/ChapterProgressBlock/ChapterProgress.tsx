import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchUserChapterInstanceChapterProgress } from "../../../../services/backend"
import Progress from "../../../../shared-module/common/components/CourseProgress"
import ErrorBanner from "../../../../shared-module/common/components/ErrorBanner"
import Spinner from "../../../../shared-module/common/components/Spinner"
import { respondToOrLarger } from "../../../../shared-module/common/styles/respond"
import ColorsIdentifier from "../CourseProgressBlock/ColorsIdentifier"

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
    queryFn: () => fetchUserChapterInstanceChapterProgress(courseInstanceId, chapterId),
  })

  return (
    <div>
      {getUserChapterProgress.isError && <ErrorBanner error={getUserChapterProgress.error} />}
      {getUserChapterProgress.isPending && <Spinner variant={"medium"} />}
      {getUserChapterProgress.isSuccess && (
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
            <ColorsIdentifier />
          </div>
        </div>
      )}
    </div>
  )
}

export default ChapterProgress

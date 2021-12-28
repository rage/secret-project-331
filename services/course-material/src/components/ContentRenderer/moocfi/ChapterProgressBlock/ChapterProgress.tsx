import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchUserChapterInstanceChapterProgress } from "../../../../services/backend"
import CircularProgress from "../../../../shared-module/components/CourseProgress/CircularProgress"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"

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
    <div className={normalWidthCenteredComponentStyles}>
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
            margin: 0 auto;
            text-align: center;
            padding: 2em 0;
          `}
        >
          {/* TODO: Verify how it looks when score_given is a floating number */}
          <CircularProgress
            max={getUserChapterProgress.data.score_maximum}
            given={getUserChapterProgress.data.score_given}
            point={50}
            label={t("chapter-progress")}
          />
        </div>
      )}
    </div>
  )
}

export default ChapterProgress

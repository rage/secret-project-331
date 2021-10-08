import { css } from "@emotion/css"
import React from "react"
import { useQuery } from "react-query"

import { fetchUserChapterProgress } from "../../../services/backend"
import CircularProgress from "../../../shared-module/components/CourseProgress/CircularProgress"
import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import GenericLoading from "../../GenericLoading"

interface ChapterProgressProps {
  chapterId: string
}

const ChapterProgress: React.FC<ChapterProgressProps> = ({ chapterId }) => {
  const { isLoading, error, data } = useQuery(`chapter-${chapterId}-progress`, () =>
    fetchUserChapterProgress(chapterId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <div className={courseMaterialCenteredComponentStyles}>
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
          max={data.score_maximum}
          given={data.score_given}
          point={50}
          label="CHAPTER PROGRESS"
        />
      </div>
    </div>
  )
}

export default ChapterProgress

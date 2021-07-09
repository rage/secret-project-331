import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"
import { useQuery } from "react-query"

import useQueryParameter from "../../../hooks/useQueryParameter"
import { fetchChaptersInTheCourse } from "../../../services/backend"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import dontRenderUntilQueryParametersReady from "../../../utils/dontRenderUntilQueryParametersReady"
import ChapterGridChapter from "../../ChapterGridChapter"
import GenericLoading from "../../GenericLoading"

const ChapterGrid: React.FC<{ courseId: string }> = ({ courseId }) => {
  const [now, setNow] = useState(new Date())
  const { data, error, isLoading } = useQuery(`course-${courseId}-chapters`, () =>
    fetchChaptersInTheCourse(courseId),
  )
  const courseSlug = useQueryParameter("courseSlug")

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <div
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <h3>Chapters in this course</h3>
      {data
        .sort((a, b) => a.chapter_number - b.chapter_number)
        .map((chapter) => {
          return (
            <ChapterGridChapter
              key={chapter.id}
              now={now}
              chapter={chapter}
              courseSlug={courseSlug}
            />
          )
        })}
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(ChapterGrid)

import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"
import { useQuery } from "react-query"

import useQueryParameter from "../../../hooks/useQueryParameter"
import { fetchChaptersInTheCourse } from "../../../services/backend"
import { wideWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
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
    <div className={wideWidthCenteredComponentStyles}>
      <h2
        className={css`
          font-style: normal;
          font-weight: bold;
          font-size: 76px;
          line-height: 76px;
          text-align: center;
        `}
      >
        Course Overview
      </h2>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
        `}
      >
        {data
          .sort((a, b) => a.chapter_number - b.chapter_number)
          .map((chapter) => {
            return (
              <div
                className={css`
                  flex: 50%;
                  @media screen and (max-width: 600px) {
                    flex: 100%;
                    width: 100%;
                  }
                `}
                key={chapter.id}
              >
                <ChapterGridChapter now={now} chapter={chapter} courseSlug={courseSlug} />
              </div>
            )
          })}
      </div>
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(ChapterGrid)

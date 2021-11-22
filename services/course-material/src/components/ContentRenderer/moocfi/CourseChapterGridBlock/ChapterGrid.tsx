import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import useQueryParameter from "../../../../hooks/useQueryParameter"
import useTime from "../../../../hooks/useTime"
import { fetchChaptersInTheCourse } from "../../../../services/backend"
import { frontendWideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import { cardMaxWidth } from "../../../../shared-module/styles/constants"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import GenericLoading from "../../../GenericLoading"

import ChapterGridCard from "./ChapterGridCard"

const YELLOW = "yellow"

const ChapterGrid: React.FC<{ courseId: string }> = ({ courseId }) => {
  const { t } = useTranslation()
  const now = useTime()
  const { data, error, isLoading } = useQuery(`course-${courseId}-chapters`, () =>
    fetchChaptersInTheCourse(courseId),
  )
  const courseSlug = useQueryParameter("courseSlug")
  const organizationSlug = useQueryParameter("organizationSlug")

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <div
      className={css`
        ${frontendWideWidthCenteredComponentStyles}
        padding: 7.5em 1em;
      `}
    >
      <h2
        className={css`
          font-style: normal;
          font-weight: bold;
          text-align: center;
          padding-bottom: 2em;
        `}
      >
        {t("course-overview")}
      </h2>
      <div
        className={css`
          @supports (display: grid) {
            display: grid;
            grid-gap: 75px;
            max-width: 1075px;
            margin: 0 auto;

            align-content: space-around;
            /* On small screens allow the cards to be really narrow */
            grid-template-columns: 1fr;
            grid-auto-rows: 1fr;
            /*
            Automatically place the cards on the grid so that they resize based on content,
            are all the same height, and don't get narrower than 500px.
            */
            @media only screen and (min-width: 500px) {
              grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
              grid-auto-rows: 1fr;
            }
          }
        `}
      >
        {data
          .sort((a, b) => a.chapter_number - b.chapter_number)
          .map((chapter) => {
            return (
              <div
                className={css`
                  width: 100%;
                  max-width: ${cardMaxWidth}em;
                  /* Basic styles for browsers without css grid support */
                  margin: 0 auto;
                  margin-bottom: 1rem;
                  @supports (display: grid) {
                    margin-bottom: 0;
                  }
                `}
                key={chapter.id}
              >
                <ChapterGridCard
                  bg={YELLOW}
                  now={now}
                  chapter={chapter}
                  courseSlug={courseSlug}
                  organizationSlug={organizationSlug}
                />
              </div>
            )
          })}
      </div>
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(ChapterGrid)

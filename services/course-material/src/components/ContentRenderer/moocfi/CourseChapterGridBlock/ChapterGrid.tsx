import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import useTime from "../../../../hooks/useTime"
import { fetchChaptersInTheCourse } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import { CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING } from "../../../../shared-module/components/LandingPageHeroSection"
import Spinner from "../../../../shared-module/components/Spinner"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import { cardMaxWidth } from "../../../../shared-module/styles/constants"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { stringToRandomNumber } from "../../../../shared-module/utils/strings"
import { withMultipleClassNames } from "../../../../shared-module/utils/styles"

import ChapterGridCard from "./ChapterGridCard"

const COLORS_ARRAY = [
  "#215887",
  "#1F6964",
  "#822630",
  "#A84835",
  "#6245A9",
  "#313947",
  "#51309F",
  "#065853",
  "#1A2333",
  "#065853",
  "#08457A",
]

const ChapterGrid: React.FC<{ courseId: string }> = ({ courseId }) => {
  const { t } = useTranslation()
  const now = useTime()
  const getChaptersInCourse = useQuery(`course-${courseId}-chapters`, () =>
    fetchChaptersInTheCourse(courseId),
  )
  const courseSlug = useQueryParameter("courseSlug")
  const organizationSlug = useQueryParameter("organizationSlug")

  return (
    <div
      className={withMultipleClassNames([
        css`
          padding: 4.5em 1em;
        `,
        CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING,
      ])}
    >
      <h1
        className={css`
          font-style: normal;
          font-weight: 600;
          text-align: center;
          padding-bottom: 1em;
          line-height: 1.1;
          font-size: clamp(2.5rem, 3vw, 3.5rem);
          margin-bottom: 3rem;
          text-transform: uppercase;
        `}
      >
        {t("course-overview")}
      </h1>
      {getChaptersInCourse.isError && (
        <ErrorBanner variant={"readOnly"} error={getChaptersInCourse.error} />
      )}
      {(getChaptersInCourse.isLoading || getChaptersInCourse.isIdle) && (
        <Spinner variant={"medium"} />
      )}
      {getChaptersInCourse.isSuccess && (
        <div
          className={css`
            @supports (display: grid) {
              display: grid;
              grid-gap: 50px;
              max-width: 1075px;
              margin: 0 auto;
              grid-template-columns: 1fr;

              ${respondToOrLarger.md} {
                grid-template-columns: 1fr 1fr;
                grid-gap: 40px;
              }
              ${respondToOrLarger.lg} {
                grid-gap: 75px;
              }
            }
          `}
        >
          {getChaptersInCourse.data.chapters
            .sort((a, b) => a.chapter_number - b.chapter_number)
            .map((chapter) => {
              const randomNumber = stringToRandomNumber(chapter.id) % COLORS_ARRAY.length
              const randomizedColor = COLORS_ARRAY[randomNumber]
              return (
                <div
                  className={css`
                    max-width: calc(${cardMaxWidth}rem / 1.1);
                    ${respondToOrLarger.md} {
                      max-width: ${cardMaxWidth}rem;
                    }

                    width: 100%;
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
                    backgroundImage={
                      "http://project-331.local/api/v0/files/course/1e0c52c7-8cb9-4089-b1c3-c24fc0dd5ae4/images/xblEKRBdiD5b5PVizOnxvw8X7qzrJD.svg"
                    }
                    bg={randomizedColor}
                    now={now}
                    chapter={chapter}
                    courseSlug={courseSlug}
                    organizationSlug={organizationSlug}
                    previewable={getChaptersInCourse.data.is_previewable}
                  />
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(ChapterGrid)

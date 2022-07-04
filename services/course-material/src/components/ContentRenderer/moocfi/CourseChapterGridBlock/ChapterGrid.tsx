import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import useTime from "../../../../hooks/useTime"
import { fetchChaptersInTheCourse } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import { CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING } from "../../../../shared-module/components/LandingPageHeroSection"
import Spinner from "../../../../shared-module/components/Spinner"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import { headingFont, secondaryFont } from "../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { stringToRandomNumber } from "../../../../shared-module/utils/strings"

import Grid from "./Grid"

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
      className={cx(
        css`
          padding: 4em 1em;
        `,
        CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING,
      )}
    >
      <h1
        className={css`
          font-style: normal;
          font-weight: 600;
          text-align: center;
          padding-bottom: 1em;
          line-height: 1.1;
          font-size: clamp(30px, 3vw, 3rem);
          margin-bottom: 1rem;
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
        <>
          {getChaptersInCourse.data.modules
            .sort((a, b) => a.order_number - b.order_number)
            .map((module) => {
              const randomNumber = stringToRandomNumber(module.id) % COLORS_ARRAY.length
              const randomizedColor = COLORS_ARRAY[randomNumber]
              return (
                <div key={module.id}>
                  {!module.is_default && (
                    <>
                      <hr
                        className={css`
                          border: dashed 2px;
                          margin: 4rem 0rem 2rem 0rem;
                          color: #d8dadc;
                          width: 85vw;
                          text-align: center;
                          margin-left: auto;
                          margin-right: auto;

                          ${respondToOrLarger.lg} {
                            width: 60vw;
                          }
                        `}
                      />
                      <div
                        className={css`
                          margin: 1rem 1rem 0.3rem 1rem;
                          text-transform: uppercase;
                          font-size: 1rem;
                          font-weight: bold;
                          text-align: center;
                          font-family: ${secondaryFont};
                        `}
                      >
                        {t("additional-module")}
                      </div>
                      <div
                        className={css`
                          margin-bottom: 2rem;
                          color: ${randomizedColor};
                          font-weight: bold;
                          font-size: 2rem;
                          text-align: center;
                          opacity: 0.8;
                          font-family: ${headingFont};
                        `}
                      >
                        {module.name}
                      </div>
                    </>
                  )}
                  <Grid
                    chapters={module.chapters}
                    courseSlug={courseSlug}
                    now={now}
                    organizationSlug={organizationSlug}
                    previewable={getChaptersInCourse.data.is_previewable}
                  />
                </div>
              )
            })}
        </>
      )}
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(ChapterGrid)

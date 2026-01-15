"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useContext, useMemo } from "react"
import { useTranslation } from "react-i18next"

import Grid from "./Grid"

import { CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING } from "@/components/course-material/LandingPageHeroSection"
import useTime from "@/hooks/course-material/useTime"
import { fetchChaptersInTheCourse, getUserChapterLocks } from "@/services/course-material/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme, headingFont, secondaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { stringToRandomNumber } from "@/shared-module/common/utils/strings"

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

const ChapterGrid: React.FC<React.PropsWithChildren<{ courseId: string }>> = ({ courseId }) => {
  const { t } = useTranslation()
  const now = useTime()
  const loginStateContext = useContext(LoginStateContext)
  const getChaptersInCourse = useQuery({
    queryKey: [`course-${courseId}-chapters`],
    queryFn: () => fetchChaptersInTheCourse(courseId),
  })
  const getUserLocks = useQuery({
    queryKey: [`course-${courseId}-user-chapter-locks`],
    queryFn: () => getUserChapterLocks(courseId),
    enabled: loginStateContext.signedIn === true,
  })
  const params = useParams<{ organizationSlug: string; courseSlug: string }>()
  const courseSlug = params?.courseSlug
  const organizationSlug = params?.organizationSlug

  const lockedChapterIds = useMemo(() => {
    if (!getUserLocks.data) {
      return new Set<string>()
    }

    const locked = new Set<string>()

    getUserLocks.data.forEach((status) => {
      if (status.status === "completed_and_locked" || status.status === "not_unlocked_yet") {
        locked.add(status.chapter_id)
      }
    })

    return locked
  }, [getUserLocks.data])

  return (
    <div
      className={cx(
        css`
          padding: 4em 1em;
        `,
        CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING,
      )}
    >
      <h2
        className={css`
          font-style: normal;
          font-weight: 700;
          text-align: center;
          color: ${baseTheme.colors.gray[700]};
          padding-bottom: 0.6em;
          line-height: 140%;
          font-size: clamp(30px, 3.5vw, 48px);
        `}
      >
        {t("course-overview")}
      </h2>
      {getChaptersInCourse.isError && (
        <ErrorBanner variant={"readOnly"} error={getChaptersInCourse.error} />
      )}
      {getChaptersInCourse.isLoading && <Spinner variant={"medium"} />}
      {getChaptersInCourse.isSuccess && courseSlug && organizationSlug && (
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
                            max-width: 1075px;
                          }
                        `}
                      />
                      <div
                        className={css`
                          margin: 1rem 1rem 0 1rem;
                          text-transform: uppercase;
                          font-size: 1rem;
                          font-weight: 500;
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
                          font-weight: 600;
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
                    lockedChapterIds={lockedChapterIds}
                  />
                </div>
              )
            })}
        </>
      )}
    </div>
  )
}

export default ChapterGrid

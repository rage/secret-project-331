import { differenceInSeconds, formatDuration } from "date-fns"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import useTime from "../../../../hooks/useTime"
import {
  fetchChapterFrontPageById,
  fetchNextPageRoutingData,
  fetchPreviousPageRoutingData,
} from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import NextSectionLink from "../../../../shared-module/components/NextSectionLink"
import Spinner from "../../../../shared-module/components/Spinner"
import { courseFrontPageRoute, coursePageRoute } from "../../../../utils/routing"

export interface NextPageProps {
  chapterId: string
  currentPageId: string
  courseSlug: string
  organizationSlug: string
}

const NextPage: React.FC<NextPageProps> = ({
  chapterId,
  currentPageId,
  organizationSlug,
  courseSlug,
}) => {
  const { t, i18n } = useTranslation()
  const now = useTime()
  const getNextPageRoutingData = useQuery(`pages-${currentPageId}-next-page`, () =>
    fetchNextPageRoutingData(currentPageId),
  )
  const getPreviousPageRoutingData = useQuery(`pages-${currentPageId}-previous-page`, () =>
    fetchPreviousPageRoutingData(currentPageId),
  )
  const getChapterFrontPageById = useQuery(`pages-${currentPageId}-chapter-front-page`, () =>
    fetchChapterFrontPageById(currentPageId),
  )

  if (getNextPageRoutingData.isError) {
    return <ErrorBanner variant={"readOnly"} error={getNextPageRoutingData.error} />
  }
  if (getNextPageRoutingData.isLoading || getNextPageRoutingData.isIdle) {
    return <Spinner variant={"medium"} />
  }

  if (getNextPageRoutingData.data === null) {
    // if data is null we have reached the end of the course material. i.e. no page or chapter found
    return (
      <NextSectionLink
        title={t("title-congratulations")}
        subtitle={t("reached-end-of-course-material")}
        nextTitle={t("action-back-to-front-page")}
        url={courseFrontPageRoute(organizationSlug, courseSlug)}
      />
    )
  }

  if (getPreviousPageRoutingData.isError) {
    return <ErrorBanner variant={"readOnly"} error={getPreviousPageRoutingData.error} />
  }
  if (getPreviousPageRoutingData.isLoading || getPreviousPageRoutingData.isIdle) {
    return <Spinner variant={"medium"} />
  }

  /* if (getNextPageRoutingData.isError) {
    return <ErrorBanner variant={"readOnly"} error={getNextPageRoutingData.error} />
  } */

  const data = getNextPageRoutingData.data
  const NUMERIC = "numeric"
  const LONG = "long"
  const nextPageUrl = coursePageRoute(organizationSlug, courseSlug, data.url_path)
  const chapterPageUrl = coursePageRoute(
    organizationSlug,
    courseSlug,
    getChapterFrontPageById.data?.url_path,
  )

  if (getPreviousPageRoutingData.data === null) {
    // if data is null we have reached the end of the course material. i.e. no page or chapter found
    // eslint-disable-next-line i18next/no-literal-string
    return (
      <NextSectionLink
        title={t("start-studying")}
        subtitle={t("proceed-to-the-first-topic")}
        nextTitle={data.title}
        url={nextPageUrl}
        chapterFrontPageURL={chapterPageUrl}
      />
    )
  }

  const previousPageData = getPreviousPageRoutingData.data
  const previousPageUrl = coursePageRoute(organizationSlug, courseSlug, previousPageData.url_path)

  // Chapter front page NextSectionLink
  if (data.chapter_front_page_id === currentPageId) {
    return (
      <NextSectionLink
        title={t("start-studying")}
        subtitle={t("proceed-to-the-first-topic")}
        nextTitle={data.title}
        url={nextPageUrl}
        previous={previousPageUrl}
        chapterFrontPageURL={chapterPageUrl}
      />
    )
  }
  if (data.chapter_status === "open") {
    if (chapterId !== data.chapter_id) {
      // End of chapter NextSectionLink
      return (
        <NextSectionLink
          title={t("impressive-reached-end-of-chapter")}
          subtitle={t("proceed-to-the-next-chapter")}
          nextTitle={data.title}
          url={nextPageUrl}
          previous={previousPageUrl}
          chapterFrontPageURL={chapterPageUrl}
        />
      )
    } else {
      // End of page NextSectionLink
      return (
        <NextSectionLink
          title={t("reached-end-of-topic")}
          subtitle={t("proceed-to-next-topic")}
          nextTitle={data.title}
          url={nextPageUrl}
          previous={previousPageUrl}
          chapterFrontPageURL={chapterPageUrl}
        />
      )
    }
  } else {
    let closedUntil
    if (data.chapter_opens_at) {
      const diffSeconds = differenceInSeconds(data.chapter_opens_at, now)
      if (diffSeconds <= 0) {
        // eslint-disable-next-line i18next/no-literal-string
        data.chapter_status = "open"
        closedUntil = t("opens-now")
        // Insert confetti drop here.
      } else if (diffSeconds < 60 * 10) {
        const minutes = Math.floor(diffSeconds / 60)
        const seconds = diffSeconds % 60
        const formatted = formatDuration({
          minutes,
          seconds,
        })
        closedUntil = t("opens-in-time", { "relative-time": formatted })
      } else {
        const date = data.chapter_opens_at.toLocaleString(i18n.language, {
          year: NUMERIC,
          month: LONG,
          day: NUMERIC,
        })
        const time = data.chapter_opens_at.toLocaleString(i18n.language, {
          hour: NUMERIC,
          minute: NUMERIC,
        })
        closedUntil = t("available-on-date-at-time", { date: date, time: time })
      }
    } else {
      closedUntil = t("closed")
    }
    return (
      // Chapter exists, but next chapter not open yet.
      <NextSectionLink
        title={t("impressive-reached-end-of-chapter")}
        subtitle={t("please-wait-until-next-chapter-opens")}
        nextTitle={closedUntil}
        previous={previousPageUrl}
        chapterFrontPageURL={getChapterFrontPageById.data?.url_path}
      />
    )
  }
}

export default NextPage

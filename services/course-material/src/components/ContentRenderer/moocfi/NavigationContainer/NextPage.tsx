import { useQuery } from "@tanstack/react-query"
import { differenceInSeconds, formatDuration, parseISO } from "date-fns"
import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"

import useTime from "../../../../hooks/useTime"
import { fetchPageNavigationData } from "../../../../services/backend"
import { courseFrontPageRoute, coursePageRoute } from "../../../../utils/routing"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import NextSectionLink from "@/shared-module/common/components/NextSectionLink"
import Spinner from "@/shared-module/common/components/Spinner"

export interface NextPageProps {
  chapterId: string | null
  currentPageId: string
  courseSlug: string
  organizationSlug: string
}

const NextPage: React.FC<React.PropsWithChildren<NextPageProps>> = ({
  chapterId,
  currentPageId,
  organizationSlug,
  courseSlug,
}) => {
  const { t, i18n } = useTranslation()
  const now = useTime()
  const [nextPageChapterOpen, setnextPageChapterOpen] = React.useState(false)

  const getPageRoutingData = useQuery({
    queryKey: [`pages-${chapterId}-page-routing-data`, currentPageId],
    queryFn: () => fetchPageNavigationData(currentPageId),
  })

  useEffect(() => {
    if (!getPageRoutingData.data) {
      return
    }
    if (!getPageRoutingData.data.next_page) {
      return
    }
    if (getPageRoutingData.data.next_page.chapter_opens_at === null) {
      setnextPageChapterOpen(true)
      return
    }
    const diffSeconds = differenceInSeconds(getPageRoutingData.data.next_page.chapter_opens_at, now)
    setnextPageChapterOpen(diffSeconds <= 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getPageRoutingData.data])

  if (getPageRoutingData.isError) {
    return <ErrorBanner variant={"readOnly"} error={getPageRoutingData.error} />
  }
  if (getPageRoutingData.isPending) {
    return <Spinner variant={"medium"} />
  }

  const { chapter_front_page, next_page, previous_page } = getPageRoutingData.data

  if (next_page === null) {
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

  if (previous_page === null) {
    // if data is null, we are in the beginning of the course (chapter-1 frontpage precisely)
    // eslint-disable-next-line i18next/no-literal-string
    return (
      <NextSectionLink
        title={t("start-studying")}
        subtitle={t("proceed-to-the-first-topic")}
        nextTitle={next_page.title}
        url={coursePageRoute(organizationSlug, courseSlug, next_page.url_path)}
      />
    )
  }

  const NUMERIC = "numeric"
  const LONG = "long"
  const nextPageUrl = coursePageRoute(organizationSlug, courseSlug, next_page.url_path)

  const previousPageUrl = coursePageRoute(organizationSlug, courseSlug, previous_page.url_path)

  if (chapter_front_page === null) {
    // if data is null, we are in the chapter front-page
    return (
      <NextSectionLink
        title={t("start-studying")}
        subtitle={t("proceed-to-the-first-topic")}
        nextTitle={next_page.title}
        url={coursePageRoute(organizationSlug, courseSlug, next_page.url_path)}
      />
    )
  }

  // eslint-disable-next-line i18next/no-literal-string
  const chapterPageUrl = coursePageRoute(organizationSlug, courseSlug, chapter_front_page.url_path)

  // Chapter front page NextSectionLink
  if (next_page.chapter_front_page_id === currentPageId) {
    return (
      <NextSectionLink
        title={t("start-studying")}
        subtitle={t("proceed-to-the-first-topic")}
        nextTitle={next_page.title}
        url={nextPageUrl}
        previous={previousPageUrl}
      />
    )
  }
  if (nextPageChapterOpen) {
    if (chapterId !== next_page.chapter_id) {
      // End of chapter NextSectionLink
      return (
        <NextSectionLink
          title={t("impressive-reached-end-of-chapter")}
          subtitle={t("proceed-to-the-next-chapter")}
          nextTitle={next_page.title}
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
          nextTitle={next_page.title}
          url={nextPageUrl}
          previous={previousPageUrl}
          chapterFrontPageURL={chapterPageUrl}
        />
      )
    }
  } else {
    let closedUntil
    if (next_page.chapter_opens_at) {
      const diffSeconds = differenceInSeconds(next_page.chapter_opens_at, now)
      if (diffSeconds <= 0) {
        // eslint-disable-next-line i18next/no-literal-string
        setnextPageChapterOpen(true)
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
        const date = parseISO(next_page.chapter_opens_at).toLocaleString(i18n.language, {
          year: NUMERIC,
          month: LONG,
          day: NUMERIC,
        })
        const time = parseISO(next_page.chapter_opens_at).toLocaleString(i18n.language, {
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
        chapterFrontPageURL={chapterPageUrl}
      />
    )
  }
}

export default NextPage

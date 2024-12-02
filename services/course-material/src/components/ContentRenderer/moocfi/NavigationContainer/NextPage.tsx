import { useQuery } from "@tanstack/react-query"
import { differenceInSeconds, formatDuration, parseISO } from "date-fns"
import { i18n, TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import useTime from "../../../../hooks/useTime"
import { fetchPageNavigationData } from "../../../../services/backend"
import { courseFrontPageRoute, coursePageRoute } from "../../../../utils/routing"

import { PageNavigationInformation } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import NextSectionLink, {
  NextSectionLinkProps,
} from "@/shared-module/common/components/NextSectionLink"
import Spinner from "@/shared-module/common/components/Spinner"

export interface NextPageProps {
  chapterId: string | null
  currentPageId: string
  courseSlug: string
  organizationSlug: string
  chapterProgress: {
    maxScore: string
    givenScore: string
    attemptedExercises: string
    totalExercises: string
  }
}

const NUMERIC = "numeric"
const LONG = "long"

const NextPage: React.FC<React.PropsWithChildren<NextPageProps>> = ({
  chapterId,
  currentPageId,
  organizationSlug,
  courseSlug,
  chapterProgress,
}) => {
  const { t, i18n } = useTranslation()
  const now = useTime()

  const getPageRoutingData = useQuery({
    queryKey: [`pages-${chapterId}-page-routing-data`, currentPageId],
    queryFn: () => fetchPageNavigationData(currentPageId),
  })

  const nextPageProps = useMemo(() => {
    if (!getPageRoutingData.data) {
      return null
    }
    return deriveNextpageProps(
      t,
      getPageRoutingData.data,
      chapterId,
      now,
      i18n,
      organizationSlug,
      courseSlug,
      currentPageId,
    )
  }, [
    chapterId,
    courseSlug,
    currentPageId,
    getPageRoutingData.data,
    i18n,
    now,
    organizationSlug,
    t,
  ])

  if (getPageRoutingData.isError) {
    return <ErrorBanner variant={"readOnly"} error={getPageRoutingData.error} />
  }
  if (getPageRoutingData.isPending || !nextPageProps) {
    return <Spinner variant={"medium"} />
  }

  return (
    // Chapter exists, but next chapter not open yet.
    <>
      {getPageRoutingData.data.next_page?.chapter_id !== chapterId && (
        <span>
          {chapterProgress.attemptedExercises} / {chapterProgress.totalExercises} ...
          {chapterProgress.givenScore}/{chapterProgress.maxScore}
        </span>
      )}
      <NextSectionLink {...nextPageProps} />
    </>
  )
}

function deriveNextpageProps(
  t: TFunction,
  info: PageNavigationInformation,
  chapterId: string | null,
  now: Date,
  i18n: i18n,
  organizationSlug: string,
  courseSlug: string,
  currentPageId: string,
): NextSectionLinkProps {
  const res: NextSectionLinkProps = {
    title: t("reached-end-of-topic"),
    subtitle: t("proceed-to-next-topic"),
    nextTitle: "",
    chapterFrontPageURL: coursePageRoute(
      organizationSlug,
      courseSlug,
      info.chapter_front_page?.url_path ?? "",
    ),
  }

  const endOfCourse = info.next_page === null
  const endOfChapter = info.next_page?.chapter_id !== chapterId
  const currentPageIsChapterFrontPage = Boolean(
    info.chapter_front_page && info.chapter_front_page.chapter_front_page_id === currentPageId,
  )
  let nextPageIsNotOpen = false
  if (info.next_page && info.next_page.chapter_opens_at !== null) {
    const diffSeconds = differenceInSeconds(info.next_page.chapter_opens_at, now)
    if (diffSeconds > 0) {
      nextPageIsNotOpen = true
    }
  }

  if (info.previous_page !== null) {
    res.previous = coursePageRoute(organizationSlug, courseSlug, info.previous_page.url_path)
  }
  if (info.next_page !== null) {
    res.nextTitle = info.next_page.title
    res.url = coursePageRoute(organizationSlug, courseSlug, info.next_page.url_path)
  }

  if (currentPageIsChapterFrontPage) {
    res.title = t("start-studying")
    res.subtitle = t("proceed-to-the-first-topic")
    res.chapterFrontPageURL = undefined
  }

  if (endOfChapter) {
    res.title = t("impressive-reached-end-of-chapter")
    res.subtitle = t("proceed-to-the-next-chapter")
  }

  if (endOfCourse) {
    res.title = t("title-congratulations")
    res.subtitle = t("reached-end-of-course-material")
    res.nextTitle = t("action-back-to-front-page")
    res.url = courseFrontPageRoute(organizationSlug, courseSlug)
  }

  if (nextPageIsNotOpen) {
    res.nextTitle = t("closed")
    res.url = undefined
    if (info.next_page?.chapter_opens_at) {
      const diffSeconds = differenceInSeconds(info.next_page.chapter_opens_at, now)
      if (diffSeconds <= 0) {
        res.nextTitle = t("opens-now")
      } else if (diffSeconds < 60 * 10) {
        const minutes = Math.floor(diffSeconds / 60)
        const seconds = diffSeconds % 60
        const formatted = formatDuration({
          minutes,
          seconds,
        })
        res.nextTitle = t("opens-in-time", { "relative-time": formatted })
      } else {
        const date = parseISO(info.next_page.chapter_opens_at).toLocaleString(i18n.language, {
          year: NUMERIC,
          month: LONG,
          day: NUMERIC,
        })
        const time = parseISO(info.next_page.chapter_opens_at).toLocaleString(i18n.language, {
          hour: NUMERIC,
          minute: NUMERIC,
        })
        res.nextTitle = t("available-on-date-at-time", { date: date, time: time })
      }
    }
  }

  return res
}

export default NextPage

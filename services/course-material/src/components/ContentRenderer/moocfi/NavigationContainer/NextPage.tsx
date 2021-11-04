import { differenceInSeconds, formatDuration } from "date-fns"
import { useRouter } from "next/router"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import useTime from "../../../../hooks/useTime"
import { getNextPageRoutingData } from "../../../../services/backend"
import NextSectionLink from "../../../../shared-module/components/NextSectionLink"
import GenericLoading from "../../../GenericLoading"

export interface NextPageProps {
  chapterId: string | null
  currentPageId: string
}

const NextPage: React.FC<NextPageProps> = ({ chapterId, currentPageId }) => {
  const { t, i18n } = useTranslation()
  const now = useTime()
  const { isLoading, error, data } = useQuery(`pages-${currentPageId}-next-page`, () =>
    getNextPageRoutingData(currentPageId),
  )
  const router = useRouter()

  const courseSlug = router.query.courseSlug

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || data === undefined) {
    return <GenericLoading />
  }

  // if data is null, we have reached the end of the course material. i.e. no page or chapter found
  if (data === null) {
    return (
      <NextSectionLink
        title={t("title-congratulations")}
        subtitle={t("reached-end-of-course-material")}
        nextTitle={t("action-back-to-front-page")}
        url={"/courses/" + courseSlug}
      />
    )
  }
  // Chapter front page NextSectionLink
  if (data.chapter_front_page_id === currentPageId) {
    return (
      <NextSectionLink
        title={t("start-studying")}
        subtitle={t("proceed-to-the-first-topic")}
        nextTitle={data.title}
        url={"/courses/" + courseSlug + data.url_path}
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
          url={"/courses/" + courseSlug + data.url_path}
        />
      )
    } else {
      // End of page NextSectionLink
      return (
        <NextSectionLink
          title={t("reached-end-of-topic")}
          subtitle={t("proceed-to-next-topic")}
          nextTitle={data.title}
          url={"/courses/" + courseSlug + data.url_path}
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
          // eslint-disable-next-line i18next/no-literal-string
          year: "numeric",
          // eslint-disable-next-line i18next/no-literal-string
          month: "long",
          // eslint-disable-next-line i18next/no-literal-string
          day: "numeric",
        })
        const time = data.chapter_opens_at.toLocaleString(i18n.language, {
          // eslint-disable-next-line i18next/no-literal-string
          hour: "numeric",
          // eslint-disable-next-line i18next/no-literal-string
          minute: "numeric",
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
      />
    )
  }
}

export default NextPage

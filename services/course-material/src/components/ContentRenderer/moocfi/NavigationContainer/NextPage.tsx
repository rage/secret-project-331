import { differenceInSeconds, formatDuration } from "date-fns"
import { useRouter } from "next/router"
import React from "react"
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
        title="Congratulations!"
        subtitle="You've reached the end of the course material!"
        nextTitle={"Back to main page"}
        url={"/courses/" + courseSlug}
      />
    )
  }
  // Chapter front page NextSectionLink
  if (data.chapter_front_page_id === currentPageId) {
    return (
      <NextSectionLink
        title="Start studying..."
        subtitle="Proceed to the first topic"
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
          title="Impressive! You've reached the end of this chapter."
          subtitle="Proceed to the next chapter"
          nextTitle={data.title}
          url={"/courses/" + courseSlug + data.url_path}
        />
      )
    } else {
      // End of page NextSectionLink
      return (
        <NextSectionLink
          title="You've reached the end of this topic."
          subtitle="Proceed to the next topic"
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
        data.chapter_status = "open"
        closedUntil = "OPENS NOW!"
        // Insert confetti drop here.
      } else if (diffSeconds < 60 * 10) {
        const minutes = Math.floor(diffSeconds / 60)
        const seconds = diffSeconds % 60
        const formatted = formatDuration({
          minutes,
          seconds,
        })
        closedUntil = `OPENS IN ${formatted}`
      } else {
        const date = data.chapter_opens_at.toLocaleString("en", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        const time = data.chapter_opens_at.toLocaleString("en", {
          hour: "numeric",
          minute: "numeric",
        })
        closedUntil = `AVAILABLE ${date} at ${time}`
      }
    } else {
      closedUntil = "CLOSED!"
    }
    return (
      // Chapter exists, but next chapter not open yet.
      <NextSectionLink
        title="Impressive! You've reached the end of this chapter."
        subtitle="Please wait until the next chapter opens"
        nextTitle={closedUntil}
      />
    )
  }
}

export default NextPage

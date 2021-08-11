import { differenceInSeconds, formatDuration } from "date-fns"
import { useQuery } from "react-query"

import { fetchPageUrl } from "../services/backend"
import { ChapterWithStatus } from "../shared-module/bindings"
import Card from "../shared-module/components/Card"

import GenericLoading from "./GenericLoading"

interface ChapterProps {
  now: Date
  chapter: ChapterWithStatus
  courseSlug: string
}

const ChapterGridChapter: React.FC<ChapterProps> = ({ now, chapter, courseSlug }) => {
  const { data, error, isLoading } = useQuery(`chapter-grid-chapter-${chapter.id}`, () => {
    if (chapter.front_page_id) {
      return fetchPageUrl(chapter.front_page_id)
    } else {
      return `chapter-${chapter.chapter_number}`
    }
  })

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  if (chapter.status == "open") {
    return (
      <Card
        variant="simple"
        title={chapter.name}
        chapter={chapter.chapter_number}
        key={chapter.id}
        url={`/courses/${courseSlug}${data}`}
      />
    )
  } else {
    let closedUntil
    if (chapter.opens_at) {
      const diffSeconds = differenceInSeconds(chapter.opens_at, now)
      if (diffSeconds < 0) {
        chapter.status = "open"
      } else if (diffSeconds < 60 * 10) {
        const minutes = Math.floor(diffSeconds / 60)
        const seconds = diffSeconds % 60
        const formatted = formatDuration({
          minutes,
          seconds,
        })
        closedUntil = `Opens in ${formatted}`
      } else {
        const date = chapter.opens_at.toLocaleString("en", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        const time = chapter.opens_at.toLocaleString("en", { hour: "numeric", minute: "numeric" })
        closedUntil = `Opens at ${date} ${time}`
      }
    } else {
      closedUntil = "Closed"
    }
    return (
      // TODO: Card to support closedUntil
      <Card variant="simple" title={chapter.name} chapter={chapter.chapter_number} key={chapter.id}>
        Chapter {chapter.chapter_number}: {chapter.name} <br />
        {closedUntil}
      </Card>
    )
  }
}

export default ChapterGridChapter

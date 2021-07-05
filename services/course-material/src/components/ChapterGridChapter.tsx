import Link from "next/link"
import { chapterBox } from "../styles/componentStyles"
import { differenceInSeconds } from "date-fns"
import { ChapterInTheCourse } from "../services/backend"
import { fetchPageUrl } from "../services/backend"
import { useQuery } from "react-query"
import GenericLoading from "./GenericLoading"
import { formatDuration } from "date-fns/esm"

interface ChapterProps {
  now: Date
  chapter: ChapterInTheCourse
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
      <div key={chapter.id} className={chapterBox}>
        <Link href={`/${courseSlug}/${data}`}>
          <a>
            Chapter {chapter.chapter_number}: {chapter.name}
          </a>
        </Link>
      </div>
    )
  } else {
    let closedUntil
    if (chapter.opens_at) {
      const diffSeconds = differenceInSeconds(chapter.opens_at, now)
      if (diffSeconds < 1) {
        closedUntil = "Opens soon"
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
      <div key={chapter.id} className={chapterBox}>
        Chapter {chapter.chapter_number}: {chapter.name} <br />
        {closedUntil}
      </div>
    )
  }
}

export default ChapterGridChapter

import { differenceInSeconds, formatDuration } from "date-fns"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchPageUrl } from "../../../services/backend"
import { ChapterWithStatus } from "../../../shared-module/bindings"
import Card from "../../../shared-module/components/Card"
import GenericLoading from "../../GenericLoading"

interface ChapterProps {
  now: Date
  chapter: ChapterWithStatus
  courseSlug: string
  bg: string
}

const ChapterGridCard: React.FC<ChapterProps> = ({ now, chapter, courseSlug, bg }) => {
  const { i18n } = useTranslation()
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
        chapterNumber={chapter.chapter_number}
        key={chapter.id}
        url={`/courses/${courseSlug}${data}`}
        bg={bg}
      />
    )
  } else {
    if (chapter.opens_at) {
      const diffSeconds = differenceInSeconds(chapter.opens_at, now)
      if (diffSeconds <= 0) {
        // eslint-disable-next-line i18next/no-literal-string
        chapter.status = "open"
        // Insert confetti drop here.
        return (
          <Card
            variant="simple"
            title={chapter.name}
            chapterNumber={chapter.chapter_number}
            key={chapter.id}
            open={true}
            bg={bg}
          />
        )
      } else if (diffSeconds < 60 * 10) {
        const minutes = Math.floor(diffSeconds / 60)
        const seconds = diffSeconds % 60
        const formatted = formatDuration({
          minutes,
          seconds,
        })
        return (
          <Card
            variant="simple"
            title={chapter.name}
            chapterNumber={chapter.chapter_number}
            key={chapter.id}
            time={formatted}
            bg={bg}
          />
        )
      } else {
        const date = chapter.opens_at.toLocaleString(i18n.language, {
          // eslint-disable-next-line i18next/no-literal-string
          year: "numeric",
          // eslint-disable-next-line i18next/no-literal-string
          month: "long",
          // eslint-disable-next-line i18next/no-literal-string
          day: "numeric",
        })
        const time = chapter.opens_at.toLocaleString(i18n.language, {
          // eslint-disable-next-line i18next/no-literal-string
          hour: "numeric",
          // eslint-disable-next-line i18next/no-literal-string
          minute: "numeric",
        })
        return (
          <Card
            variant="simple"
            title={chapter.name}
            chapterNumber={chapter.chapter_number}
            key={chapter.id}
            date={date}
            time={time}
            bg={bg}
          />
        )
      }
    } else {
      return (
        <Card
          variant="simple"
          title={chapter.name}
          chapterNumber={chapter.chapter_number}
          key={chapter.id}
          open={false}
          bg={bg}
        />
      )
    }
  }
}

export default ChapterGridCard

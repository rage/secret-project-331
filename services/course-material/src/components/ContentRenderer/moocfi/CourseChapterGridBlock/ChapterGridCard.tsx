import { differenceInSeconds, formatDuration } from "date-fns"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchPageUrl } from "../../../../services/backend"
import { ChapterWithStatus } from "../../../../shared-module/bindings"
import Card from "../../../../shared-module/components/Card"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { coursePageRoute } from "../../../../utils/routing"

interface ChapterProps {
  now: Date
  chapter: ChapterWithStatus
  courseSlug: string
  bg: string
  organizationSlug: string
}

const NUMERIC = "numeric"
const LONG = "long"
const OPEN = "open"

const ChapterGridCard: React.FC<ChapterProps> = ({
  now,
  chapter,
  courseSlug,
  bg,
  organizationSlug,
}) => {
  const { i18n } = useTranslation()
  const getChapterPageUrl = useQuery(`chapter-grid-chapter-${chapter.id}`, () => {
    if (chapter.front_page_id) {
      return fetchPageUrl(chapter.front_page_id)
    } else {
      return `/chapter-${chapter.chapter_number}`
    }
  })

  if (getChapterPageUrl.isError) {
    return <ErrorBanner variant={"readOnly"} error={getChapterPageUrl.error} />
  }

  if (getChapterPageUrl.isLoading || getChapterPageUrl.isIdle) {
    return <Spinner variant={"small"} />
  }

  if (chapter.status === OPEN) {
    return (
      <Card
        variant="simple"
        title={chapter.name}
        chapterNumber={chapter.chapter_number}
        key={chapter.id}
        url={coursePageRoute(organizationSlug, courseSlug, getChapterPageUrl.data)}
        bg={bg}
      />
    )
  } else {
    if (chapter.opens_at) {
      const diffSeconds = differenceInSeconds(chapter.opens_at, now)
      if (diffSeconds <= 0) {
        chapter.status = OPEN
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
          year: NUMERIC,
          month: LONG,
          day: NUMERIC,
        })
        const time = chapter.opens_at.toLocaleString(i18n.language, {
          hour: NUMERIC,
          minute: NUMERIC,
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

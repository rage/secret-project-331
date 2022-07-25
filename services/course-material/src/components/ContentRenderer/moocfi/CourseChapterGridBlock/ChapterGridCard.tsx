import { useQuery } from "@tanstack/react-query"
import { differenceInSeconds, formatDuration } from "date-fns"
import { useTranslation } from "react-i18next"

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
  previewable: boolean
  backgroundImage?: string | null
}

const NUMERIC = "numeric"
const LONG = "long"
const OPEN = "open"

const ChapterGridCard: React.FC<React.PropsWithChildren<ChapterProps>> = ({
  now,
  chapter,
  courseSlug,
  bg,
  organizationSlug,
  previewable,
  backgroundImage,
}) => {
  const { i18n } = useTranslation()
  const getChapterPageUrl = useQuery([`chapter-grid-chapter-${chapter.id}`], () => {
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

  let date = undefined
  let time = undefined
  if (chapter.status !== OPEN && chapter.opens_at) {
    const diffSeconds = differenceInSeconds(chapter.opens_at, now)
    if (diffSeconds <= 0) {
      chapter.status = OPEN
      // Insert confetti drop here.
    } else if (diffSeconds < 60 * 10) {
      // opens in 10 minutes
      const minutes = Math.floor(diffSeconds / 60)
      const seconds = diffSeconds % 60
      time = formatDuration({
        minutes,
        seconds,
      })
    } else {
      // opens in over 10 minutes
      date = chapter.opens_at.toLocaleString(i18n.language, {
        year: NUMERIC,
        month: LONG,
        day: NUMERIC,
      })
      time = chapter.opens_at.toLocaleString(i18n.language, {
        hour: NUMERIC,
        minute: NUMERIC,
      })
    }
  }
  const open = chapter.status === OPEN
  const url =
    open || previewable
      ? coursePageRoute(organizationSlug, courseSlug, getChapterPageUrl.data)
      : undefined
  return (
    <Card
      variant={backgroundImage ? "illustration" : "simple"}
      title={chapter.name}
      chapterNumber={chapter.chapter_number}
      key={chapter.id}
      open={open}
      date={date}
      time={time}
      url={url}
      bg={bg}
      backgroundImage={backgroundImage}
    />
  )
}

export default ChapterGridCard

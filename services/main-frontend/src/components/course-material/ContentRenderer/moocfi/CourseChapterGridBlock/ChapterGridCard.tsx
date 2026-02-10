"use client"

import { useQuery } from "@tanstack/react-query"
import { differenceInSeconds, formatDuration, parseISO } from "date-fns"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"

import Card from "@/components/Card"
import { useChapterProgress } from "@/hooks/course-material/useChapterProgress"
import { fetchPageUrl } from "@/services/course-material/backend"
import { ChapterWithStatus } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import Circle from "@/shared-module/common/img/card-defualt-bg/circle.svg"
import Cross from "@/shared-module/common/img/card-defualt-bg/cross.svg"
import DotCircle from "@/shared-module/common/img/card-defualt-bg/dot-circle.svg"
import Equal from "@/shared-module/common/img/card-defualt-bg/equal.svg"
import Intersection from "@/shared-module/common/img/card-defualt-bg/intersection.svg"
import PixelSquare from "@/shared-module/common/img/card-defualt-bg/pixel-square.svg"
import QuadrupleCircle from "@/shared-module/common/img/card-defualt-bg/quadruple-circle.svg"
import Triangle from "@/shared-module/common/img/card-defualt-bg/triangle.svg"
import { materialInstanceAtom } from "@/state/course-material/selectors"
import { coursePageRoute } from "@/utils/course-material/routing"

interface ChapterProps {
  now: Date
  bg: string
  chapter: ChapterWithStatus
  courseSlug: string
  organizationSlug: string
  previewable: boolean
  backgroundImage?: string | null
  isLocked: boolean
}

const NUMERIC = "numeric"
const LONG = "long"
const OPEN = "open"

const arr: string[] = [
  Triangle,
  Equal,
  Circle,
  Intersection,
  QuadrupleCircle,
  Cross,
  DotCircle,
  PixelSquare,
  Circle,
  Cross,
]

const ChapterGridCard: React.FC<React.PropsWithChildren<ChapterProps>> = ({
  now,
  bg,
  chapter,
  courseSlug,
  organizationSlug,
  previewable,
  backgroundImage,
  isLocked,
}) => {
  const { i18n } = useTranslation()
  const courseInstance = useAtomValue(materialInstanceAtom)

  const getChapterPageUrl = useQuery({
    queryKey: [`chapter-grid-chapter`, chapter.id, chapter.front_page_id],
    queryFn: () => {
      if (chapter.front_page_id) {
        return fetchPageUrl(chapter.front_page_id)
      } else {
        return `/chapter-${chapter.chapter_number}`
      }
    },
  })

  const getChapterProgress = useChapterProgress(courseInstance?.id, chapter.id)

  if (getChapterPageUrl.isError) {
    return <ErrorBanner variant={"readOnly"} error={getChapterPageUrl.error} />
  }

  if (getChapterPageUrl.isLoading) {
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
      date = parseISO(chapter.opens_at).toLocaleString(i18n.language, {
        year: NUMERIC,
        month: LONG,
        day: NUMERIC,
      })
      time = parseISO(chapter.opens_at).toLocaleString(i18n.language, {
        hour: NUMERIC,
        minute: NUMERIC,
      })
    }
  }
  const open = chapter.status === OPEN
  const url =
    (open || previewable) && getChapterPageUrl.data
      ? coursePageRoute(organizationSlug, courseSlug, getChapterPageUrl.data)
      : undefined

  const pointsData =
    (open || previewable) && getChapterProgress.data
      ? {
          awarded: getChapterProgress.data.score_given,
          max: getChapterProgress.data.score_maximum,
        }
      : undefined

  const showLock = !open && !previewable
  const hasExerciseDeadlineOverrides = chapter.exercise_deadline_override_count > 0
  const exerciseDeadlinesMultiple = chapter.exercise_deadline_override_distinct_count > 1

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
      bg={chapter.color !== null ? chapter.color : bg}
      backgroundImage={backgroundImage ? backgroundImage : arr[chapter.chapter_number - 1]}
      points={pointsData}
      showLock={showLock}
      isLocked={isLocked}
      deadline={chapter.deadline}
      exerciseDeadline={
        hasExerciseDeadlineOverrides ? chapter.earliest_exercise_deadline_override : null
      }
      exerciseDeadlinesMultiple={hasExerciseDeadlineOverrides && exerciseDeadlinesMultiple}
    />
  )
}

export default ChapterGridCard

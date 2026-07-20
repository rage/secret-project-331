"use client"

import { useQuery } from "@tanstack/react-query"
import { differenceInSeconds, formatDuration, parseISO } from "date-fns"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"

import Card from "@/components/Card"
import { renderReadOnlyBlockingError } from "@/components/queryResultErrorRenderers"
import { getCourseMaterialPageUrlPath } from "@/generated/course-material-api/sdk.generated"
import type { ChapterWithStatus } from "@/generated/course-material-api/types.generated"
import { useChapterProgress } from "@/hooks/course-material/useChapterProgress"
import Circle from "@/shared-module/common/img/card-defualt-bg/circle.svg"
import Cross from "@/shared-module/common/img/card-defualt-bg/cross.svg"
import DotCircle from "@/shared-module/common/img/card-defualt-bg/dot-circle.svg"
import Equal from "@/shared-module/common/img/card-defualt-bg/equal.svg"
import Intersection from "@/shared-module/common/img/card-defualt-bg/intersection.svg"
import PixelSquare from "@/shared-module/common/img/card-defualt-bg/pixel-square.svg"
import QuadrupleCircle from "@/shared-module/common/img/card-defualt-bg/quadruple-circle.svg"
import Triangle from "@/shared-module/common/img/card-defualt-bg/triangle.svg"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { QueryResult } from "@/shared-module/components"
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
    queryKey: [`chapter-grid-chapter`, chapter.id, chapter.front_page_id, chapter.chapter_number],
    queryFn: () => {
      if (chapter.front_page_id) {
        return getCourseMaterialPageUrlPath({
          path: {
            current_page_id: chapter.front_page_id,
          },
        })
      }
      return `/chapter-${chapter.chapter_number}`
    },
  })

  const getChapterProgress = useChapterProgress(courseInstance?.id, chapter.id)

  return (
    <QueryResult query={getChapterPageUrl} renderBlockingError={renderReadOnlyBlockingError}>
      {(chapterPageUrl) => {
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
          (open || previewable) && chapterPageUrl
            ? coursePageRoute(organizationSlug, courseSlug, chapterPageUrl)
            : undefined

        const pointsData =
          (open || previewable) && getChapterProgress.data
            ? {
                awarded: getChapterProgress.data.score_given,
                max: getChapterProgress.data.score_maximum,
              }
            : undefined

        const cardBg = chapter.color !== null ? chapter.color : bg
        const cardBackgroundImage = backgroundImage
          ? backgroundImage
          : arr[chapter.chapter_number - 1]
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
            {...omitUndefined({ date })}
            {...omitUndefined({ time })}
            {...omitUndefined({ url })}
            {...omitUndefined({ bg: cardBg })}
            {...omitUndefined({ backgroundImage: cardBackgroundImage })}
            {...omitUndefined({ points: pointsData })}
            showLock={showLock}
            isLocked={isLocked}
            deadline={chapter.deadline ?? null}
            exerciseDeadline={
              hasExerciseDeadlineOverrides
                ? (chapter.earliest_exercise_deadline_override ?? null)
                : null
            }
            exerciseDeadlinesMultiple={hasExerciseDeadlineOverrides && exerciseDeadlinesMultiple}
          />
        )
      }}
    </QueryResult>
  )
}

export default ChapterGridCard

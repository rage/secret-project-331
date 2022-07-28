import { css } from "@emotion/css"

import { ChapterWithStatus } from "../../../../shared-module/bindings"
import { cardMaxWidth } from "../../../../shared-module/styles/constants"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import { stringToRandomNumber } from "../../../../shared-module/utils/strings"

import ChapterGridCard from "./ChapterGridCard"

const COLORS_ARRAY = [
  "#215887",
  "#1F6964",
  "#822630",
  "#A84835",
  "#6245A9",
  "#313947",
  "#51309F",
  "#065853",
  "#1A2333",
  "#065853",
  "#08457A",
]

export interface StyledCardProps {
  chapter: ChapterWithStatus
  courseSlug: string
  now: Date
  organizationSlug: string
  previewable: boolean
}

/**
 * This component should probably just be merged with `ChapterGridCard` but that is subject for further
 * refactoring.
 */
const StyledCard: React.FC<React.PropsWithChildren<StyledCardProps>> = ({
  chapter,
  courseSlug,
  now,
  organizationSlug,
  previewable,
}) => {
  const randomNumber = stringToRandomNumber(chapter.id) % COLORS_ARRAY.length
  const randomizedColor = COLORS_ARRAY[randomNumber]
  return (
    <div
      className={css`
        max-width: calc(${cardMaxWidth}rem / 1.1);
        ${respondToOrLarger.md} {
          max-width: ${cardMaxWidth}rem;
        }

        width: 100%;
        /* Basic styles for browsers without css grid support */
        margin: 0 auto;
        margin-bottom: 1rem;
        @supports (display: grid) {
          margin-bottom: 0;
        }
      `}
    >
      <ChapterGridCard
        backgroundImage={chapter.chapter_image_url}
        bg={randomizedColor}
        now={now}
        chapter={chapter}
        courseSlug={courseSlug}
        organizationSlug={organizationSlug}
        previewable={previewable}
      />
    </div>
  )
}

export default StyledCard

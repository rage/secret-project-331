"use client"

import { css } from "@emotion/css"

import StyledCard from "./StyledCard"

import type { ChapterWithStatus } from "@/generated/course-material-api/types.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export interface GridProps {
  chapters: ChapterWithStatus[]
  courseSlug: string
  now: Date
  organizationSlug: string
  previewable: boolean
  lockedChapterIds: Set<string>
}

const Grid: React.FC<React.PropsWithChildren<GridProps>> = ({
  chapters,
  courseSlug,
  now,
  organizationSlug,
  previewable,
  lockedChapterIds,
}) => {
  return (
    <ul
      className={css`
        list-style: none;
        padding: 0;
        margin: 0;

        @supports (display: grid) {
          display: grid;
          gap: 20px;
          max-width: 1075px;
          margin: 0 auto;
          grid-template-columns: 1fr;

          ${respondToOrLarger.md} {
            grid-template-columns: 1fr 1fr;
            gap: 40px;
          }
          ${respondToOrLarger.lg} {
            gap: 40px;
          }
        }
      `}
    >
      {chapters
        .sort((a, b) => a.chapter_number - b.chapter_number)
        .map((chapter) => (
          <li key={chapter.id}>
            <StyledCard
              chapter={chapter}
              courseSlug={courseSlug}
              now={now}
              organizationSlug={organizationSlug}
              previewable={previewable}
              isLocked={lockedChapterIds.has(chapter.id)}
            />
          </li>
        ))}
    </ul>
  )
}

export default Grid

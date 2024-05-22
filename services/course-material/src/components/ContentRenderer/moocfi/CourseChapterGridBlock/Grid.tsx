import { css } from "@emotion/css"

import StyledCard from "./StyledCard"

import { ChapterWithStatus } from "@/shared-module/common/bindings"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export interface GridProps {
  chapters: ChapterWithStatus[]
  courseSlug: string
  now: Date
  organizationSlug: string
  previewable: boolean
}

const Grid: React.FC<React.PropsWithChildren<GridProps>> = ({
  chapters,
  courseSlug,
  now,
  organizationSlug,
  previewable,
}) => {
  return (
    <div
      className={css`
        @supports (display: grid) {
          display: grid;
          grid-gap: 20px;
          max-width: 1075px;
          margin: 0 auto;
          grid-template-columns: 1fr;

          ${respondToOrLarger.md} {
            grid-template-columns: 1fr 1fr;
            grid-gap: 40px;
          }
          ${respondToOrLarger.lg} {
            grid-gap: 40px;
          }
        }
      `}
    >
      {chapters
        .sort((a, b) => a.chapter_number - b.chapter_number)
        .map((chapter) => (
          <StyledCard
            key={chapter.id}
            chapter={chapter}
            courseSlug={courseSlug}
            now={now}
            organizationSlug={organizationSlug}
            previewable={previewable}
          />
        ))}
    </div>
  )
}

export default Grid

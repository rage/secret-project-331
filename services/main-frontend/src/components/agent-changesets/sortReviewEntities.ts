import type { FieldValue, ReviewEntity } from "@/generated/api/types.generated"

function numberField(entity: ReviewEntity, field: string): number | null {
  const value: FieldValue | null | undefined = entity.field_changes.find(
    (change) => change.field === field,
  )?.after
  return value?.type === "number" ? Number(value.value) : null
}

function pageOf(entity: ReviewEntity) {
  return entity.kind === "page" ? (entity.after ?? entity.base ?? null) : null
}

/**
 * Orders entities as the course reads: the course front page, then each chapter with its front
 * page and pages, then everything else in the order given. Chapters are ordered by the chapter
 * number the changeset sets; one whose number the changeset leaves alone sorts after the rest,
 * as the review has no other source for it.
 */
export function sortReviewEntities(
  entities: ReviewEntity[],
  chapterFrontPageIds: ReadonlySet<string>,
): ReviewEntity[] {
  const chapterIds: string[] = []
  const chapterNumbers = new Map<string, number>()
  const noteChapter = (chapterId: string | null | undefined) => {
    if (chapterId && !chapterIds.includes(chapterId)) {
      chapterIds.push(chapterId)
    }
  }
  for (const entity of entities) {
    if (entity.entity_type === "chapter") {
      noteChapter(entity.entity_id)
      const chapterNumber = numberField(entity, "chapter_number")
      if (chapterNumber !== null) {
        chapterNumbers.set(entity.entity_id, chapterNumber)
      }
    } else {
      noteChapter(pageOf(entity)?.chapter_id)
    }
  }
  const chapterRank = new Map(
    chapterIds
      .toSorted(
        (a, b) =>
          (chapterNumbers.get(a) ?? Infinity) - (chapterNumbers.get(b) ?? Infinity) ||
          chapterIds.indexOf(a) - chapterIds.indexOf(b),
      )
      .map((chapterId, rank) => [chapterId, rank]),
  )

  const sortKey = (entity: ReviewEntity): number[] => {
    if (entity.entity_type === "chapter") {
      return [1, chapterRank.get(entity.entity_id) ?? Infinity, 0, 0]
    }
    const page = pageOf(entity)
    if (page === null) {
      return [2, 0, 0, 0]
    }
    if (!page.chapter_id) {
      return page.url_path === "/" ? [0, 0, 0, 0] : [2, 0, 0, page.order_number]
    }
    const isFrontPage = chapterFrontPageIds.has(entity.entity_id)
    return [1, chapterRank.get(page.chapter_id) ?? Infinity, isFrontPage ? 1 : 2, page.order_number]
  }

  return entities
    .map((entity, index) => ({ entity, index, key: sortKey(entity) }))
    .toSorted((a, b) => {
      for (let i = 0; i < a.key.length; i++) {
        const difference = (a.key[i] ?? 0) - (b.key[i] ?? 0)
        if (difference !== 0 && !Number.isNaN(difference)) {
          return difference
        }
      }
      return a.index - b.index
    })
    .map(({ entity }) => entity)
}

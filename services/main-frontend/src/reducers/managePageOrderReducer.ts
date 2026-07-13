import { produce, type WritableDraft } from "immer"
import type { Dictionary } from "lodash"
import { groupBy, mapValues, max, orderBy } from "lodash"

import type { Chapter, CourseStructure, Page } from "@/generated/api/types.generated"

interface ManagePageOrderLoading {
  state: "loading"
  chapterIdToPages: null
  chapterIdToFrontPage: null
  unsavedChanges: false
  unsavedChapterChanges: false
  chapters: null
}

interface ManagePageOrderReady {
  state: "ready"
  chapterIdToPages: Dictionary<Page[]>
  chapterIdToFrontPage: Dictionary<Page>
  unsavedChanges: boolean
  unsavedChapterChanges: boolean
  chapters: Chapter[]
}

export type ManagePageOrderState = ManagePageOrderLoading | ManagePageOrderReady

interface SetDataAction {
  type: "setData"
  payload: CourseStructure
}

interface MoveAction {
  type: "move"
  payload: { chapterId: string | null; pageId?: string | null; direction: "up" | "down" }
}

export const managePageOrderInitialState: ManagePageOrderState = {
  state: "loading",
  chapterIdToPages: null,
  chapterIdToFrontPage: null,
  unsavedChanges: false,
  unsavedChapterChanges: false,
  chapters: null,
}

export type ManagePageOrderAction = SetDataAction | MoveAction

export default function managePageOrderReducer(
  prev: ManagePageOrderState,
  action: ManagePageOrderAction,
): ManagePageOrderState {
  return produce(prev, (draftState) => {
    switch (action.type) {
      case "setData": {
        const chaptersWithFrontpages = action.payload.chapters.filter(
          (c) => c.front_page_id !== null,
        )
        // Clone the chapters and pages before storing them in the state. The objects we get from
        // react-query may be frozen (immer's autoFreeze freezes them once they end up in produced
        // state, and react-query's structural sharing reuses the same frozen references across
        // refetches). The order-number/chapter-number normalization below mutates these objects in
        // place, and mutating a frozen object throws "Cannot assign to read only property", which
        // previously left unsavedChanges unset and hid the "save the ordering" prompt (e.g. after
        // deleting a page).
        const chapters = action.payload.chapters.filter((c) => c.id !== null).map((c) => ({ ...c }))
        const orderedPages = orderBy(
          action.payload.pages.map((page) => ({ ...page })),
          [(page) => page.order_number, (page) => page.id],
          ["asc", "asc"],
        )

        const withoutFrontpages = orderedPages.filter(
          (page) =>
            !(
              page.url_path.trim() === "/" ||
              chaptersWithFrontpages.some((c) => c.front_page_id === page.id)
            ),
        )
        const groupedWithoutFrontpages = groupBy(withoutFrontpages, (page) => page.chapter_id)
        const onlyFrontPages = orderedPages.filter(
          (page) =>
            page.url_path.trim() === "/" ||
            chaptersWithFrontpages.some((c) => c.front_page_id === page.id),
        )
        const groupedOnlyFrontpages = groupBy(onlyFrontPages, (page) => page.chapter_id)
        const chapterIdToFrontpage = mapValues(groupedOnlyFrontpages, (pages) => pages[0])

        draftState.state = "ready"
        draftState.unsavedChanges = false
        draftState.unsavedChapterChanges = false
        draftState.chapterIdToPages = groupedWithoutFrontpages
        draftState.chapterIdToFrontPage = chapterIdToFrontpage
        draftState.chapters = chapters
        break
      }
      case "move": {
        const { direction, chapterId } = action.payload
        const pageId = action.payload.pageId

        if (!pageId && chapterId) {
          const chapters = draftState.chapters
          if (!chapters) {
            break
          }
          moveChapterWithinChapterList(chapters, chapterId, direction, draftState)
        }

        if (pageId) {
          if (!draftState.chapterIdToPages) {
            break
          }

          // how we actually move the page depends on whether the move is within a chapter or not
          const currentPageChapterId = Object.values(draftState.chapterIdToPages)
            .flat()
            .find((page) => page.id === pageId)?.chapter_id

          if (!currentPageChapterId) {
            // page is currently a top level page
            // For now we won't support moving a top level page to a chapter
            const toplevelPages = draftState.chapterIdToPages["null"]
            if (!toplevelPages) {
              break
            }
            movePageWithinPageList(toplevelPages, pageId, direction, draftState)
            break
          }

          if (currentPageChapterId === chapterId) {
            // move within a chapter
            const pages = draftState.chapterIdToPages?.[chapterId ?? "null"]
            if (!pages) {
              break
            }
            movePageWithinPageList(pages, pageId, direction, draftState)
          } else {
            // moving a page to a different chapter, the new location will be the last page of the new chapter
            const oldChapterPageList = draftState.chapterIdToPages?.[currentPageChapterId ?? "null"]
            const newChapterPageList = draftState.chapterIdToPages?.[chapterId ?? "null"]
            const page = oldChapterPageList?.find((p) => p.id === pageId)

            if (!page) {
              break
            }

            draftState.chapterIdToPages[currentPageChapterId ?? "null"] =
              oldChapterPageList?.filter((o) => o.id !== pageId)
            const largestOrderNumber = max(newChapterPageList?.map((p) => p.order_number)) ?? -1
            page.order_number = largestOrderNumber + 1
            page.chapter_id = chapterId
            draftState.chapterIdToPages[chapterId ?? "null"] = (newChapterPageList ?? []).concat(
              page,
            )

            draftState.unsavedChanges = true
          }
        }

        break
      }
    }

    // There may be gaps or wrong order numbers in the pages.
    // We'll iterate through pages and make sure the order numbers sequential
    // If we end up changing some order number, we'll set unsavedChanges to true
    // so that the changes can be saved
    if (draftState.chapterIdToPages) {
      const chapterIdToPages = draftState.chapterIdToPages
      Object.values(chapterIdToPages).forEach((pages) => {
        pages.forEach((page, index) => {
          // Front page is always index 0, so the first page in the chapter is index 1
          const expectedOrderNumber = index + 1
          if (page.order_number !== expectedOrderNumber) {
            // setData clones pages so this assignment is safe, but stay defensive: a frozen page
            // (e.g. via immer autoFreeze) must not crash the whole view. Mark unsaved changes
            // regardless so the "save the page ordering" prompt is never silently skipped.
            draftState.unsavedChanges = true
            try {
              page.order_number = expectedOrderNumber
            } catch (e) {
              console.warn(`Could not update page order number for ${page.id}`, e)
            }
          }
        })
      })
      // Set front page order numbers to 0
      Object.values(draftState.chapterIdToFrontPage).forEach((page) => {
        if (page.order_number !== 0) {
          draftState.unsavedChanges = true
          try {
            page.order_number = 0
          } catch (e) {
            console.warn(`Could not update front page order number for ${page.id}`, e)
          }
        }
      })
    }

    // There may be gaps in chapter numbers, so we'll iterate through chapters and make sure
    // the chapter numbers are sequential
    if (draftState.chapters) {
      const chapters = draftState.chapters
      chapters
        .toSorted((c1, c2) => c1.chapter_number - c2.chapter_number)
        .forEach((chapter, index) => {
          const expectedChapterNumber = index + 1
          if (chapter.chapter_number !== expectedChapterNumber) {
            draftState.unsavedChapterChanges = true
            try {
              chapter.chapter_number = expectedChapterNumber
            } catch (e) {
              console.warn(`Could not update chapter number for ${chapter.id}`, e)
            }
          }
        })
    }
  })
}

function movePageWithinPageList(
  pages: Page[],
  pageToMoveId: string,
  direction: "up" | "down",
  draftState: WritableDraft<ManagePageOrderLoading> | WritableDraft<ManagePageOrderReady>,
) {
  const currentIndex = pages.findIndex((page) => page.id === pageToMoveId)
  if (currentIndex === -1) {
    return
  }
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= pages.length) {
    return
  }

  const temp = pages[currentIndex]
  pages[currentIndex] = pages[targetIndex]
  pages[targetIndex] = temp

  const tempOrderNumber = pages[currentIndex].order_number
  pages[currentIndex].order_number = pages[targetIndex].order_number
  pages[targetIndex].order_number = tempOrderNumber

  draftState.unsavedChanges = true
}

function moveChapterWithinChapterList(
  chapters: Chapter[],
  chapterToMoveId: string,
  direction: "up" | "down",
  draftState: WritableDraft<ManagePageOrderLoading> | WritableDraft<ManagePageOrderReady>,
) {
  const currentChapter = chapters.find((chapter) => chapter.id === chapterToMoveId)

  if (currentChapter === undefined) {
    return
  }
  const currentChapterNumber = currentChapter.chapter_number

  const targetChapterNumber =
    direction === "up" ? currentChapterNumber - 1 : currentChapterNumber + 1
  if (targetChapterNumber < 0 || targetChapterNumber > chapters.length) {
    return
  }

  const currentIndex = chapters.findIndex((c) => c.chapter_number === currentChapterNumber)
  const targetIndex = chapters.findIndex((c) => c.chapter_number === targetChapterNumber)

  const temp = currentChapterNumber
  chapters[currentIndex].chapter_number = targetChapterNumber
  chapters[targetIndex].chapter_number = temp

  draftState.unsavedChapterChanges = true
}

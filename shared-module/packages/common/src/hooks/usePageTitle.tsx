"use client"

import { useSetAtom } from "jotai"
import { useId, useLayoutEffect } from "react"

import { nextPageTitleSeq, pageTitleEntriesAtom } from "./pageTitleAtoms"

/**
 * Registers a localized page title for the current view. The title is set on `document.title`
 * (formatted as "Page name - Site name") by the single {@link PageTitleManager} mounted near the
 * app root, and announced to screen readers on change.
 *
 * Pass an already-translated string so the `t()` call stays in the component — this keeps the
 * strict `i18next/no-literal-string` lint happy and makes the title react to language changes:
 *
 * ```tsx
 * usePageTitle(t("settings-title"))
 * usePageTitle(course?.name ?? null) // async/data-derived; null until the data loads
 * ```
 *
 * When a layout and a deeper page both set a title, the deepest wins: pass a higher `order` for
 * more specific views (layouts low, leaf pages high). A blank/`null`/`undefined` title registers
 * nothing, so a loading leaf falls back to a parent layout's title rather than blanking it.
 *
 * @param title - The localized page title, or `null`/`undefined` while it is not yet known.
 * @param opts.key - Stable identity for this registration. Defaults to a per-instance id.
 * @param opts.order - Priority; higher wins. Defaults to `0`.
 */
export function usePageTitle(
  title: string | null | undefined,
  opts?: { key?: string; order?: number },
): void {
  const generatedKey = useId()
  const key = opts?.key ?? generatedKey
  const order = opts?.order ?? 0
  const trimmedTitle = title?.trim()
  const setEntries = useSetAtom(pageTitleEntriesAtom)

  // Unregister on unmount (e.g. navigating away) so the title falls back to the next source.
  useLayoutEffect(() => {
    return () => {
      setEntries((prev) => {
        if (!(key in prev)) {
          return prev
        }
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }, [setEntries, key])

  // Register/update while a non-blank title is set; drop the entry while it is blank/loading.
  // Runs in a layout effect so the title lands in the same commit as a navigation render,
  // before Next's built-in route announcer reads `document.title`.
  useLayoutEffect(() => {
    if (!trimmedTitle) {
      setEntries((prev) => {
        if (!(key in prev)) {
          return prev
        }
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }
    setEntries((prev) => ({
      ...prev,
      [key]: { key, order, title: trimmedTitle, seq: nextPageTitleSeq() },
    }))
  }, [setEntries, key, order, trimmedTitle])
}

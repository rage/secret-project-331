"use client"

import { useSetAtom } from "jotai"
import { useCallback, useId, useLayoutEffect } from "react"

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
  // Always-unique identity for this hook instance, even when an explicit `opts.key` is shared
  // by several mounted callers. Used as the entry's `owner` so unmount cleanup only deletes a
  // slot this instance still owns.
  const owner = useId()
  const key = opts?.key ?? owner
  const order = opts?.order ?? 0
  const trimmedTitle = title?.trim()
  const setEntries = useSetAtom(pageTitleEntriesAtom)

  // Drop our entry, but only while it is still ours: if another instance has since taken the
  // same `key` (last-writer-wins), leave its entry in place.
  const unregister = useCallback(() => {
    setEntries((prev) => {
      if (prev[key]?.owner !== owner) {
        return prev
      }
      const { [key]: _omit, ...next } = prev
      return next
    })
  }, [setEntries, key, owner])

  // Unregister on unmount (e.g. navigating away) so the title falls back to the next source.
  useLayoutEffect(() => unregister, [unregister])

  // Register/update while a non-blank title is set; drop the entry while it is blank/loading.
  // Runs in a layout effect so the atom write — and the `<title>` re-render it triggers in
  // PageTitleManager — lands during the navigation commit, before Next's built-in route
  // announcer (a passive effect) reads `document.title`.
  useLayoutEffect(() => {
    if (!trimmedTitle) {
      unregister()
      return
    }
    setEntries((prev) => {
      // Assign `seq` once per registration and keep it stable across updates so a mere
      // re-render does not jump the queue ahead of an equal-`order` sibling.
      const existing = prev[key]
      const seq = existing && existing.owner === owner ? existing.seq : nextPageTitleSeq()
      return {
        ...prev,
        [key]: { key, order, title: trimmedTitle, seq, owner },
      }
    })
  }, [setEntries, unregister, key, order, trimmedTitle, owner])
}

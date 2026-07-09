"use client"

import { atom } from "jotai"

/**
 * One registered page-title source. Multiple may be registered at once (e.g. a layout and a
 * leaf page); the deepest/highest-`order` entry wins. `seq` is a monotonic registration counter
 * used to break ties deterministically (last writer at a given `order` wins); it is assigned
 * once per registration and kept stable across updates. `owner` is the id of the hook instance
 * that registered the entry, so an unmounting instance only deletes a slot it still owns.
 */
export type PageTitleEntry = {
  key: string
  order: number
  title: string
  seq: number
  owner: string
}

/** Keyed registry of active page-title sources. Written by {@link usePageTitle}. */
export const pageTitleEntriesAtom = atom<Record<string, PageTitleEntry>>({})

/**
 * The single winning page title: the entry with the highest `order`, ties broken by the highest
 * `seq`. Returns `null` when nothing is registered (the manager then shows the bare site name).
 */
export const resolvedPageTitleAtom = atom<string | null>((get) => {
  let best: PageTitleEntry | null = null
  for (const entry of Object.values(get(pageTitleEntriesAtom))) {
    if (
      best === null ||
      entry.order > best.order ||
      (entry.order === best.order && entry.seq > best.seq)
    ) {
      best = entry
    }
  }
  return best?.title ?? null
})

let seqCounter = 0

/** Returns a process-monotonic sequence number for ordering registrations within a level. */
export const nextPageTitleSeq = (): number => ++seqCounter

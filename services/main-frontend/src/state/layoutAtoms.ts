import { atom } from "jotai"

/** Current organization slug for the active page. */
export const organizationSlugAtom = atom<string | null>(null)
/** Whether the current page should be hidden from search engines. */
export const hideFromSearchEnginesAtom = atom<boolean>(false)

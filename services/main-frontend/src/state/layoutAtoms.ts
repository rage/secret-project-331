import { atom } from "jotai"

/** Current organization slug for the active page. */
export const organizationSlugAtom = atom<string | null>(null)

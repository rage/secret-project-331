import { atom } from "jotai"

export const organizationSlugAtom = atom<string | null>(null)
export const hideFromSearchEnginesAtom = atom<boolean>(false)

import { createContext } from "react"

import { PageState } from "../reducers/pageStateReducer"

interface LayoutContextType {
  title: string | null
  setTitle: (title: string | null) => void
  organizationSlug: string | null
  setOrganizationSlug: (organizationSlug: string | null) => void
  courseId: string | null
  setCourseId: (courseId: string | null) => void
  hideFromSearchEngines: boolean
  setHideFromSearchEngines: (hideFromSearchEngines: boolean) => void
  setPageState: (pageState: PageState) => void
}

const LayoutContext = createContext<LayoutContextType>({
  title: null,
  setTitle: () => {
    throw new Error("setTitle called outside provider.")
  },
  organizationSlug: null,
  setOrganizationSlug: () => {
    throw new Error("setOrganizationSlug called outside provider.")
  },
  courseId: null,
  setCourseId: () => {
    throw new Error("setCourseId called outside provider.")
  },
  hideFromSearchEngines: false,
  setHideFromSearchEngines: () => {
    throw new Error("setHideFromSearchEngines called outside provider.")
  },
  setPageState: () => {
    throw new Error("setPageState called outside provider.")
  },
})

export default LayoutContext

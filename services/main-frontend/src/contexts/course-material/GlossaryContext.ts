import React from "react"

import type { Term } from "@/generated/course-material-api/types.generated"

export interface GlossaryState {
  terms: Term[]
}

export const defaultGlossaryState: GlossaryState = {
  terms: [],
}

export const GlossaryContext = React.createContext(defaultGlossaryState)

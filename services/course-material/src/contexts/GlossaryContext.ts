import React from "react"

import { Term } from "../shared-module/common/bindings"

export interface GlossaryState {
  terms: Term[]
}

export const defaultGlossaryState: GlossaryState = {
  terms: [],
}

export const GlossaryContext = React.createContext(defaultGlossaryState)

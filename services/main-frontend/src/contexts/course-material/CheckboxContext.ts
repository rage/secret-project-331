import React from "react"
import type { Control } from "react-hook-form"

export interface ContextProps {
  /** Undefined outside a `SelectResearchConsentForm` provider; consumers should render nothing. */
  control: Control<Record<string, boolean>> | undefined
}

export const CheckboxContext = React.createContext<ContextProps>({ control: undefined })

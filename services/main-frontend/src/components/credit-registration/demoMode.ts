import { createContext, useContext } from "react"

/** True under the credit registration demo, where a way off the page would break it. */
const DemoModeContext = createContext(false)

export const DemoModeProvider = DemoModeContext.Provider

/** Whether the page is drawn by the credit registration demo rather than for a real student. */
export const useIsDemoMode = (): boolean => useContext(DemoModeContext)

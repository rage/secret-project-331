import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react"

interface AccordionContextType {
  expandAll: () => void
  collapseAll: () => void
  registerAccordion: (ref: HTMLDetailsElement) => void
  unregisterAccordion: (ref: HTMLDetailsElement) => void
}

export const AccordionContext = createContext<AccordionContextType | undefined>(undefined)

export const AccordionProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const accordionsRef = useRef<Set<HTMLDetailsElement>>(new Set())

  const registerAccordion = useCallback((ref: HTMLDetailsElement) => {
    accordionsRef.current.add(ref)
  }, [])

  const unregisterAccordion = useCallback((ref: HTMLDetailsElement) => {
    accordionsRef.current.delete(ref)
  }, [])

  const expandAll = useCallback(() => {
    accordionsRef.current.forEach((accordion) => {
      accordion.open = true
    })
  }, [])

  const collapseAll = useCallback(() => {
    accordionsRef.current.forEach((accordion) => {
      accordion.open = false
    })
  }, [])

  const controls = useMemo(
    () => ({
      expandAll,
      collapseAll,
      registerAccordion,
      unregisterAccordion,
    }),
    [expandAll, collapseAll, registerAccordion, unregisterAccordion],
  )

  return <AccordionContext.Provider value={controls}>{children}</AccordionContext.Provider>
}

export const useAccordionContext = (): AccordionContextType => {
  const context = useContext(AccordionContext)
  if (!context) {
    throw new Error("useAccordionContext must be used within an AccordionProvider")
  }
  return context
}

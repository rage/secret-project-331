import React, { createContext, PropsWithChildren, useContext, useState } from "react"

interface AccordionContextType {
  expandAll: () => void
  collapseAll: () => void
  registerAccordion: (ref: HTMLDetailsElement) => void
  unregisterAccordion: (ref: HTMLDetailsElement) => void
}

export const AccordionContext = createContext<AccordionContextType | undefined>(undefined)

export const AccordionProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [accordions, setAccordions] = useState<Set<HTMLDetailsElement>>(new Set())

  const controls = React.useMemo(
    () => ({
      expandAll: () => {
        accordions.forEach((accordion) => {
          accordion.open = true
        })
      },
      collapseAll: () => {
        accordions.forEach((accordion) => {
          accordion.open = false
        })
      },
      registerAccordion: (ref: HTMLDetailsElement) => {
        setAccordions((prev) => new Set(prev).add(ref))
      },
      unregisterAccordion: (ref: HTMLDetailsElement) => {
        setAccordions((prev) => {
          const next = new Set(prev)
          next.delete(ref)
          return next
        })
      },
    }),
    [accordions],
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

"use client"

import { createContext, type ReactNode, useContext, useMemo } from "react"

import type {
  CourseDesignerPlanSectionStatus,
  CourseDesignerStage,
} from "@/generated/api/types.generated"

interface SectionStatusContextValue {
  planId: string
  findStatus: (
    stage: CourseDesignerStage,
    sectionKey: string,
  ) => CourseDesignerPlanSectionStatus | null
}

const SectionStatusContext = createContext<SectionStatusContextValue | null>(null)

/** Makes the plan's section Ready/Unfinished marks available to the workspace forms. */
export function SectionStatusProvider(props: {
  planId: string
  sectionStatuses: readonly CourseDesignerPlanSectionStatus[]
  children: ReactNode
}) {
  const { planId, sectionStatuses, children } = props
  const value = useMemo<SectionStatusContextValue>(() => {
    const byKey = new Map(
      sectionStatuses.map((status) => [`${status.stage}/${status.section_key}`, status]),
    )
    return {
      planId,
      findStatus: (stage, sectionKey) => byKey.get(`${stage}/${sectionKey}`) ?? null,
    }
  }, [planId, sectionStatuses])
  return <SectionStatusContext.Provider value={value}>{children}</SectionStatusContext.Provider>
}

/** Reads the marks provided by the nearest `SectionStatusProvider`. */
export function useSectionStatuses(): SectionStatusContextValue {
  const value = useContext(SectionStatusContext)
  if (value === null) {
    throw new Error("useSectionStatuses must be used inside SectionStatusProvider")
  }
  return value
}

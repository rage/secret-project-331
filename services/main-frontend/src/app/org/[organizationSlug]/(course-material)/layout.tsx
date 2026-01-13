"use client"

import { useAtomValue, useSetAtom } from "jotai"
import React, { useEffect } from "react"

import CourseMaterialEffects from "@/components/course-material/CourseMaterialEffects"
import PartnersSectionBlock from "@/components/course-material/layout/PartnersSection"
import Centered from "@/shared-module/common/components/Centering/Centered"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { viewParamsAtom } from "@/state/course-material/params"
import { currentCourseIdAtom } from "@/state/course-material/selectors"

function CourseMaterialLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Suppress unused params warning
  void params

  const courseId = useAtomValue(currentCourseIdAtom)
  const setViewParams = useSetAtom(viewParamsAtom)

  useEffect(() => {
    return () => {
      setViewParams(null)
    }
  }, [setViewParams])

  return (
    <>
      <CourseMaterialEffects />
      <Centered variant="narrow">{children}</Centered>
      {courseId && <PartnersSectionBlock courseId={courseId} />}
    </>
  )
}

export default withErrorBoundary(CourseMaterialLayout)

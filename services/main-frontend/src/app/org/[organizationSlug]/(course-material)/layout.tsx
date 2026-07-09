"use client"

import { useAtomValue, useSetAtom } from "jotai"
import React, { useEffect } from "react"

import { useRegisterCourseMaterial } from "@/components/breadcrumbs/useRegisterCourseMaterial"
import CourseMaterialEffects from "@/components/course-material/CourseMaterialEffects"
import PartnersSectionBlock from "@/components/course-material/layout/PartnersSection"
import Centered from "@/shared-module/common/components/Centering/Centered"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { viewParamsAtom } from "@/state/course-material/params"
import { currentCourseIdAtom, materialCourseAtom } from "@/state/course-material/selectors"

function CourseMaterialLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Suppress unused params warning
  void params

  useRegisterCourseMaterial()

  const courseId = useAtomValue(currentCourseIdAtom)
  const setViewParams = useSetAtom(viewParamsAtom)

  // Baseline title for the whole course-material section: the course name shows while a page
  // loads; the leaf page overrides it with the specific page title (higher order). On exam
  // routes there is no material course, so this registers nothing and the exam page sets the title.
  usePageTitle(useAtomValue(materialCourseAtom)?.name ?? null)

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

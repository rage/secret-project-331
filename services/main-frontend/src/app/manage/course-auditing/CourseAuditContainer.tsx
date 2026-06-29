"use client"

import { QueryObserverResult } from "@tanstack/react-query"
import React from "react"

import CourseAuditCard from "./CourseAuditCard"

import type { CourseAudit } from "@/generated/api/types.generated"

interface CourseAuditEditorProps {
  coursesForAuditing: CourseAudit[]
  refetch(): Promise<QueryObserverResult<CourseAudit[], unknown>>
}

const CourseAuditContainer: React.FC<React.PropsWithChildren<CourseAuditEditorProps>> = ({
  coursesForAuditing,
  refetch,
}) => (
  <div>
    {coursesForAuditing.map((course) => (
      <CourseAuditCard key={course.id} id={course.id} courseAudit={course} refetch={refetch} />
    ))}
  </div>
)

export default CourseAuditContainer

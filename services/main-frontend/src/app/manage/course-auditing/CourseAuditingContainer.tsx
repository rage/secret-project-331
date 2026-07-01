"use client"

import { QueryObserverResult } from "@tanstack/react-query"
import React from "react"

import CourseAuditingCard from "./CourseAuditingCard"

import type { CourseToAudit } from "@/generated/api/types.generated"

interface CourseAuditingEditorProps {
  coursesForAuditing: CourseToAudit[]
  refetch(): Promise<QueryObserverResult<CourseToAudit[], unknown>>
}

const CourseAuditingContainer: React.FC<React.PropsWithChildren<CourseAuditingEditorProps>> = ({
  coursesForAuditing,
  refetch,
}) => (
  <div>
    {coursesForAuditing.map((course) => (
      <CourseAuditingCard key={course.id} id={course.id} courseToAudit={course} refetch={refetch} />
    ))}
  </div>
)

export default CourseAuditingContainer

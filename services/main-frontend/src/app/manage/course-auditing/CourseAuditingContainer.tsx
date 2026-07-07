"use client"

import { css } from "@emotion/css"
import { QueryObserverResult } from "@tanstack/react-query"
import React from "react"

import CourseAuditingCard from "./CourseAuditingCard"
import type { CourseFilter } from "./page"

import type { CourseToAudit } from "@/generated/api/types.generated"

interface CourseAuditingEditorProps {
  coursesForAuditing: CourseToAudit[]
  refetch(): Promise<QueryObserverResult<CourseToAudit[], unknown>>
  filterParams: CourseFilter
}

const CourseAuditingContainer: React.FC<React.PropsWithChildren<CourseAuditingEditorProps>> = ({
  coursesForAuditing,
  refetch,
  filterParams,
}) => {
  const filteredCourses = coursesForAuditing.filter(
    (course) =>
      course.name.toLocaleLowerCase().includes(filterParams.searchCourse?.toLocaleLowerCase()) ||
      course.description
        ?.toLocaleLowerCase()
        .includes(filterParams.searchCourse?.toLocaleLowerCase()),
  )

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
      `}
    >
      {filteredCourses.map((course) => (
        <CourseAuditingCard
          key={course.id}
          id={course.id}
          courseToAudit={course}
          refetch={refetch}
        />
      ))}
    </div>
  )
}

export default CourseAuditingContainer

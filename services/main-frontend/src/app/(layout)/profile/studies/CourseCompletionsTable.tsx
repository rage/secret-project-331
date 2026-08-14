"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { MyStudiesCourse, MyStudiesCourseModule } from "@/generated/api/types.generated"
import { dateToString } from "@/shared-module/common/utils/time"
import type { TableColumn } from "@/shared-module/components"
import { Table } from "@/shared-module/components"

import { EM_DASH } from "../constants"

export interface CourseCompletionsTableProps {
  course: MyStudiesCourse
}

/** Lists every module, completed or not, so the student also sees what is still ahead. */
const CourseCompletionsTable: React.FC<CourseCompletionsTableProps> = ({ course }) => {
  const { t } = useTranslation()

  const grade = (module: MyStudiesCourseModule): string => {
    const completion = module.completion
    if (!completion) {
      return EM_DASH
    }
    if (completion.grade !== null && completion.grade !== undefined) {
      return String(completion.grade)
    }
    return completion.passed ? t("label-passed") : t("label-not-passed")
  }

  const columns: TableColumn<MyStudiesCourseModule>[] = [
    {
      header: t("label-module"),
      cell: (module) => module.name ?? course.course_name,
    },
    { header: t("label-grade"), cell: grade },
    {
      header: t("label-completed"),
      cell: (module) =>
        module.completion ? dateToString(module.completion.completion_date, false) : EM_DASH,
    },
    { header: t("label-ects-credits"), cell: (module) => module.ects_credits ?? EM_DASH },
  ]

  return (
    <Table
      columns={columns}
      rows={course.modules}
      rowKey={(module) => module.course_module_id}
      caption={t("completions-in-course", { course: course.course_name })}
    />
  )
}

export default CourseCompletionsTable

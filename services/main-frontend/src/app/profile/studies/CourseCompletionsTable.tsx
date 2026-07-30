"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { MyStudiesCourse, MyStudiesCourseModule } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"

import { EM_DASH } from "../constants"

export interface CourseCompletionsTableProps {
  course: MyStudiesCourse
}

// The table scrolls inside the accordion instead of pushing the page sideways on mobile.
const scrollWrapperCss = css`
  overflow-x: auto;
`

const tableCss = css`
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;

  th,
  td {
    text-align: left;
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid ${baseTheme.colors.clear[300]};
    vertical-align: top;
  }

  th {
    color: ${baseTheme.colors.gray[500]};
    font-weight: 600;
    white-space: nowrap;
  }

  td {
    color: ${baseTheme.colors.gray[700]};
    font-variant-numeric: tabular-nums;
  }
`

/**
 * The student's own completion record for one course: every module, with the grade, date and credits
 * of the completion if there is one. Modules the student has not completed are listed with empty
 * values rather than left out, so the table shows what is still ahead of them.
 */
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

  return (
    <div className={scrollWrapperCss}>
      <table className={tableCss}>
        <caption className="screen-reader-only">
          {t("completions-in-course", { course: course.course_name })}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("label-module")}</th>
            <th scope="col">{t("label-grade")}</th>
            <th scope="col">{t("label-completed")}</th>
            <th scope="col">{t("label-ects-credits")}</th>
          </tr>
        </thead>
        <tbody>
          {course.modules.map((module) => (
            <tr key={module.course_module_id}>
              <td>{module.name ?? course.course_name}</td>
              <td>{grade(module)}</td>
              <td>
                {module.completion
                  ? dateToString(module.completion.completion_date, false)
                  : EM_DASH}
              </td>
              <td>
                {module.ects_credits !== null && module.ects_credits !== undefined
                  ? module.ects_credits
                  : EM_DASH}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CourseCompletionsTable

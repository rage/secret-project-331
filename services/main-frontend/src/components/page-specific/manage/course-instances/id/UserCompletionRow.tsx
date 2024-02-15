import { css } from "@emotion/css"
import { times } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  CourseModule,
  CourseModuleCompletionWithRegistrationInfo,
} from "../../../../../shared-module/common/bindings"
import { FullWidthTableRow } from "../../../../tables/FullWidthTable"

export interface UserCompletionRowProps {
  sortedCourseModules: Array<CourseModule>
  user: UserCompletionRowUser
}

export interface UserCompletionRowUser {
  /** Maps module id to an array of all completions for that module. */
  moduleCompletions: Map<string, Array<CourseModuleCompletionWithRegistrationInfo>>
  email: string
  firstName: string | null
  lastName: string | null
  userId: string
}

const PlayerCompletionRow: React.FC<UserCompletionRowProps> = ({ sortedCourseModules, user }) => {
  const { t } = useTranslation()

  function mapGradeToText(completion: CourseModuleCompletionWithRegistrationInfo): JSX.Element {
    let innerText = completion.grade?.toString()
    if (innerText === undefined) {
      innerText = completion.passed ? t("column-passed") : t("column-failed")
    }
    if (completion.prerequisite_modules_completed) {
      return <>{innerText}</>
    } else {
      return <i>{innerText}*</i>
    }
  }

  function mapRegistration(completion: CourseModuleCompletionWithRegistrationInfo): JSX.Element {
    if (completion.registered) {
      return <>{t("yes")}</>
    } else if (completion.completion_registration_attempt_date) {
      return <i>{t("column-pending")}</i>
    } else {
      return <></>
    }
  }

  // let maxCompletions = max(user.completedModules.values())
  // const asd = new Map<string, Array<CourseModuleCompletionWithRegistrationInfo>>()
  let maxCompletions = 1
  for (const completions of Array.from(user.moduleCompletions.values())) {
    maxCompletions = Math.max(maxCompletions, completions.length)
  }
  // for (const completion of user.completed_modules) {
  //   const bucket = asd.get(completion.course_module_id) ?? []
  //   bucket.push(completion)
  //   asd.set(completion.course_module_id, bucket)
  //   maxCompletions = Math.max(bucket.length, maxCompletions)
  // }

  const anyCompletions = sortedCourseModules.some((module) => {
    const completion = user.moduleCompletions.get(module.id)?.[0]
    return Boolean(completion)
  })

  return (
    <>
      <FullWidthTableRow
        className={css`
          ${!anyCompletions && `filter: opacity(0.60);`}
        `}
      >
        <td rowSpan={maxCompletions}>{user.userId}</td>
        <td rowSpan={maxCompletions}>
          {user.firstName} {user.lastName}
        </td>
        <td rowSpan={maxCompletions}>{user.email}</td>
        {sortedCourseModules.map((module) => {
          const completion = user.moduleCompletions.get(module.id)?.[0]
          return (
            <React.Fragment key={module.id}>
              <td>{completion ? mapGradeToText(completion) : "-"}</td>
              <td>{completion ? mapRegistration(completion) : ""}</td>
            </React.Fragment>
          )
        })}
      </FullWidthTableRow>
      {/* Render extra rows if there are any. */}
      {times(maxCompletions - 1, (i) => {
        return (
          <FullWidthTableRow
            className={css`
              ${!anyCompletions && `filter: opacity(0.55);`}
            `}
            key={i}
          >
            {sortedCourseModules.map((module) => {
              // First index we want is 1 but iteration starts from 0.
              const completion = user.moduleCompletions.get(module.id)?.[i + 1]
              return (
                <React.Fragment key={module.id}>
                  <td>{completion ? mapGradeToText(completion) : "-"}</td>
                  <td>{completion ? mapRegistration(completion) : ""}</td>
                </React.Fragment>
              )
            })}
          </FullWidthTableRow>
        )
      })}
    </>
  )
}

export default PlayerCompletionRow

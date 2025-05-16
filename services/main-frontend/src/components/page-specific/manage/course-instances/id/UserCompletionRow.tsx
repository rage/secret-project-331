import { css } from "@emotion/css"
import { times } from "lodash"
import React, { JSX } from "react"
import { useTranslation } from "react-i18next"

import { FullWidthTableRow } from "../../../../tables/FullWidthTable"

import {
  CourseModule,
  CourseModuleCompletionWithRegistrationInfo,
} from "@/shared-module/common/bindings"

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

  let maxCompletions = 1
  for (const completions of Array.from(user.moduleCompletions.values())) {
    maxCompletions = Math.max(maxCompletions, completions.length)
  }

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
      {times(maxCompletions - 1, (i) => {
        return (
          <FullWidthTableRow
            className={css`
              ${!anyCompletions && `filter: opacity(0.55);`}
            `}
            key={i}
          >
            {sortedCourseModules.map((module) => {
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

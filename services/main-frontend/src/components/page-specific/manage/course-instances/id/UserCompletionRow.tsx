import React from "react"
import { useTranslation } from "react-i18next"

import {
  CourseModule,
  CourseModuleCompletionWithRegistrationInfo,
  UserWithModuleCompletions,
} from "../../../../../shared-module/bindings"
import { FullWidthTableRow } from "../../../../tables/FullWidthTable"

export interface UserCompletionRowProps {
  courseModules: Array<CourseModule>
  user: UserWithModuleCompletions
}

const PlayerCompletionRow: React.FC<UserCompletionRowProps> = ({ courseModules, user }) => {
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

  return (
    <FullWidthTableRow>
      <td>{user.user_id}</td>
      <td>
        {user.first_name} {user.last_name}
      </td>
      <td>{user.email}</td>
      {courseModules
        .sort((a, b) => a.order_number - b.order_number)
        .map((module) => {
          const completion = user.completed_modules.find((x) => x.course_module_id === module.id)
          return (
            <React.Fragment key={module.id}>
              <td>{completion ? mapGradeToText(completion) : "-"}</td>
              <td>{completion ? mapRegistration(completion) : ""}</td>
            </React.Fragment>
          )
        })}
    </FullWidthTableRow>
  )
}

export default PlayerCompletionRow

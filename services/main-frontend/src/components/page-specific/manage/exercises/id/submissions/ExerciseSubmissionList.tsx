import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { Submission } from "../../../../../../shared-module/bindings"

interface Props {
  exerciseSubmissions: Submission[]
}

const ExerciseSubmissionList: React.FC<Props> = ({ exerciseSubmissions: submissions }) => {
  const { t } = useTranslation()
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>{t("label-link")}</th>
            <th>{t("label-submission-time")}</th>
            <th>{t("label-student")}</th>
            <th>{t("label-course-instance")}</th>
            <th>{t("label-exercise-task")}</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((x) => (
            <tr key={x.id}>
              <td>
                <Link
                  href={{
                    pathname: "/submissions/[id]",
                    query: { id: x.id },
                  }}
                >
                  {t("link")}
                </Link>
              </td>
              <td>{x.created_at.toISOString()}</td>
              <td>{x.user_id}</td>
              <td>{x.course_instance_id}</td>
              <td>{x.exercise_task_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export default ExerciseSubmissionList

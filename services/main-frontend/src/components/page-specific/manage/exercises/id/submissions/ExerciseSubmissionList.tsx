import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { ExerciseSlideSubmission } from "../../../../../../shared-module/bindings"

interface Props {
  exerciseSubmissions: ExerciseSlideSubmission[]
}

const ExerciseSubmissionList: React.FC<React.PropsWithChildren<Props>> = ({
  exerciseSubmissions,
}) => {
  const { t } = useTranslation()
  if (exerciseSubmissions.length === 0) {
    return <div>{t("no-submissions")}</div>
  }
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>{t("label-link")}</th>
            <th>{t("label-submission-time")}</th>
            <th>{t("label-student")}</th>
            <th>{t("label-course-instance")}</th>
            <th>{t("label-exam")}</th>
          </tr>
        </thead>
        <tbody>
          {exerciseSubmissions.map((x) => (
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
              <td>{x.exam_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export default ExerciseSubmissionList

import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { ExerciseSlideSubmission } from "../../../../../../shared-module/bindings"
import LinkIcon from "../../../../../../shared-module/img/link.svg"
import {
  baseTheme,
  fontWeights,
  headingFont,
  secondaryFont,
} from "../../../../../../shared-module/styles"

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
      <table
        className={css`
          border-collapse: collapse;
          border: 1px solid ${baseTheme.colors.clear[300]};
          margin-top: 1.5rem;
          width: 100%;

          td,
          th {
            max-width: 0;
            border-left: 1px solid ${baseTheme.colors.clear[300]};
            border-right: 1px solid ${baseTheme.colors.clear[300]};
            padding-left: 30px;
            padding-right: 30px;
            text-align: left;
            height: 60px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        `}
      >
        <thead>
          <tr
            className={css`
              font-family: ${secondaryFont};
              font-weight: ${fontWeights.semibold};
              font-size: ${baseTheme.fontSizes[14]};
              color: ${baseTheme.colors.gray[600]};
              text-transform: uppercase;
              opacity: 0.8;
              padding-right: 30px;
            `}
          >
            <th
              className={css`
                width: 9%;
              `}
            >
              {t("label-link")}
            </th>
            <th
              className={css`
                width: 18%;
              `}
            >
              {t("label-submission-time")}
            </th>
            <th>{t("label-student")}</th>
            <th>{t("label-course-instance")}</th>
            <th
              className={css`
                width: 18%;
              `}
            >
              {t("label-exam")}
            </th>
          </tr>
        </thead>
        <tbody
          className={css`
            tr:nth-child(odd) {
              background-color: ${baseTheme.colors.clear[100]};
            }
          `}
        >
          {exerciseSubmissions.map((x) => (
            <tr
              key={x.id}
              className={css`
                font-family: ${headingFont};
                font-weight: ${fontWeights.normal};
                font-size: ${baseTheme.fontSizes[16]};
                color: ${baseTheme.colors.gray[400]};
                line-height: 1rem;
              `}
            >
              <td
                className={css`
                  font-size: 20px;
                  text-align: center !important;
                `}
              >
                <Link
                  href={{
                    pathname: "/submissions/[id]",
                    query: { id: x.id },
                  }}
                >
                  <LinkIcon />
                </Link>
              </td>
              <td>{x.created_at.toLocaleString()}</td>
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

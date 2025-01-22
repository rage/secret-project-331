import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { FlaggedAnswer } from "@/shared-module/common/bindings"
import Accordion from "@/shared-module/common/components/Accordion"
import { baseTheme } from "@/shared-module/common/styles"

export interface FlaggedPeerReviewAccordionProps {
  reports: Array<FlaggedAnswer>
  title: string
}

// eslint-disable-next-line i18next/no-literal-string
const Title = styled.h5`
  border-top: 1px solid ${baseTheme.colors.clear[600]};
  border-bottom: 1px solid ${baseTheme.colors.clear[600]};
  padding: 1rem 1.5rem 1rem;
`

const FlaggedPeerReviewAccordion: React.FC<FlaggedPeerReviewAccordionProps> = ({
  reports,
  title,
}) => {
  const { t } = useTranslation()

  return (
    <Accordion variant="detail">
      <details>
        <summary>
          {title}
          <span
            className={css`
              background: ${baseTheme.colors.green[400]};
              border-radius: 20px;
              line-height: 10px;
              padding: 1px 5px;
              text-align: center;
              font-size: 14px;
              color: ${baseTheme.colors.primary[100]};
              margin-left: 3px;
              width: 20px;
              height: 20px;
            `}
          >
            {reports.length}
          </span>
        </summary>
        <div
          className={css`
            background: ${baseTheme.colors.clear[100]};
            margin: 0.5rem 0;
          `}
        >
          {reports.map((report, index) => (
            <div key={report.submission_id}>
              <Title>
                {t("label-report")} {index + 1}
              </Title>
              <ul>
                <li>
                  <strong>{t("label-reason")}: </strong> {report.reason}
                </li>
                <li>
                  <strong>{t("text-field-label-description")}: </strong>
                  {report.description || t("no-description-available")}
                </li>
                <li>
                  <strong>{t("label-flagged-by")}:</strong> {report.flagged_by}
                </li>
                <li>
                  <strong>{t("label-created-at")}</strong>{" "}
                  {new Date(report.created_at).toLocaleString()}
                </li>
              </ul>
            </div>
          ))}
        </div>
      </details>
    </Accordion>
  )
}

export default FlaggedPeerReviewAccordion

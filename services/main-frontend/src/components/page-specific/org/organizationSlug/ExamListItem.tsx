import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

interface Exam {
  id: string
  name: string
  starts_at: string | null
  ends_at: string | null
  time_minutes: number
  minimum_points_treshold: number
}

interface Props {
  exam: Exam
  organizationSlug: string
}

const ListItem = styled.li`
  margin: 0.5rem 0;
  padding: 1.5rem;
  background-color: ${baseTheme.colors.primary[100]};
  border: 1px solid ${baseTheme.colors.clear[300]};
  border-radius: 6px;
`

const ExamHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;

  a {
    color: ${baseTheme.colors.blue[600]};
    font-size: 1.1rem;
    font-weight: bold;
  }
`

const ExamDetails = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[500]};
`

// eslint-disable-next-line i18next/no-literal-string
const Detail = styled.div`
  display: flex;
  flex-direction: column;

  .label {
    font-weight: bold;
    margin-bottom: 0.2rem;
  }

  .value {
    color: ${baseTheme.colors.gray[700]};
  }
`

// eslint-disable-next-line i18next/no-literal-string
const ManageLink = styled.div`
  margin-top: 0.5rem;

  a {
    color: ${baseTheme.colors.blue[600]};
  }
`

const ExamListItem: React.FC<Props> = ({ exam, organizationSlug }) => {
  const { t } = useTranslation()

  return (
    <ListItem>
      <ExamHeader>
        <a href={`/org/${organizationSlug}/exams/${exam.id}`}>{exam.name}</a>
      </ExamHeader>
      <ExamDetails>
        <Detail>
          <span className="label">{t("start-date")}:</span>
          <span className="value">
            {exam.starts_at ? new Date(exam.starts_at).toLocaleDateString() : t("n-a")}
          </span>
        </Detail>
        <Detail>
          <span className="label">{t("end-date")}:</span>
          <span className="value">
            {exam.ends_at ? new Date(exam.ends_at).toLocaleDateString() : t("n-a")}
          </span>
        </Detail>
        <Detail>
          <span className="label">{t("duration")}:</span>
          <span className="value">
            {exam.time_minutes} {t("minutes")}
          </span>
        </Detail>
      </ExamDetails>
      <ManageLink>
        <a href={`/manage/exams/${exam.id}`}>{t("manage")}</a>
      </ManageLink>
    </ListItem>
  )
}

export default ExamListItem

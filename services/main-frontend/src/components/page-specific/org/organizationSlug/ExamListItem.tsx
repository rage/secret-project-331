import styled from "@emotion/styled"
import { parseISO } from "date-fns"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { baseTheme } from "@/shared-module/common/styles"
import { dateToDateTimeLocalString } from "@/shared-module/common/utils/time"

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

const ManageLink = styled.div`
  margin-top: 0.5rem;

  a {
    color: ${baseTheme.colors.blue[600]};
  }
`

const ExamListItem: React.FC<Props> = ({ exam, organizationSlug }) => {
  const { t } = useTranslation()

  return (
    <ListItem data-testid="exam-list-item">
      <ExamHeader>
        <Link href={`/org/${organizationSlug}/exams/${exam.id}`}>{exam.name}</Link>
      </ExamHeader>
      <ExamDetails>
        <Detail>
          <span className="label">{t("start-date")}:</span>
          <span className="value">
            <HideTextInSystemTests
              text={exam.starts_at ? dateToDateTimeLocalString(parseISO(exam.starts_at)) : t("n-a")}
              testPlaceholder={dateToDateTimeLocalString(parseISO("2022-01-01T00:00:00"))}
            />
          </span>
        </Detail>
        <Detail>
          <span className="label">{t("end-date")}:</span>
          <span className="value">
            <HideTextInSystemTests
              text={exam.ends_at ? dateToDateTimeLocalString(parseISO(exam.ends_at)) : t("n-a")}
              testPlaceholder={dateToDateTimeLocalString(parseISO("2022-01-01T00:00:00"))}
            />
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
        <Link href={`/manage/exams/${exam.id}`}>{t("manage")}</Link>
      </ManageLink>
    </ListItem>
  )
}

export default ExamListItem

"use client"

import { css } from "@emotion/css"
import { QueryObserverResult } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import { useTranslation } from "react-i18next"

import ContentArea from "./ContentArea"

import type { CourseAudit } from "@/generated/api/types.generated"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
interface CourseAuditCardProps {
  id: string
  courseAudit: CourseAudit
  refetch(): Promise<QueryObserverResult<CourseAudit[], unknown>>
}

const CourseAuditCard: React.FC<React.PropsWithChildren<CourseAuditCardProps>> = ({
  id,
  courseAudit,
  refetch,
}) => {
  const { t } = useTranslation()
  const course = courseAudit

  const onChange = (key: string) => (value: string) => {
    console.log("test")
  }

  return (
    <div>
      <div
        key={id}
        className={css`
          margin: 8px;
          padding: 1rem;
          border: 1px solid rgba(0, 0, 0, 0.12);
          /* Override card's overflow */
          overflow: visible !important;
        `}
      >
        <div
          className={css`
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            line-height: 1.5;
            padding-bottom: 1.5rem;
            align-items: baseline;
          `}
        >
          <div>
            <h1
              className={css`
                margin: 0;
                font-weight: 400;
                font-size: 1.5rem;
              `}
            >
              {course.name}
            </h1>
          </div>
        </div>
        <div>
          <ContentArea
            title={t("title-description")}
            text={course.description}
            editing={false}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("description")}
            type={"text"}
            error={undefined}
          />
        </div>
        <ContentArea
          title={t("title-default-module-uh-course-code")}
          text={course.uh_course_code}
          editing={false}
          // eslint-disable-next-line i18next/no-literal-string
          onChange={onChange("uh_course_code")}
          type={"text"}
          error={undefined}
        />
        <div
          className={css`
            display: flex;
            justify-content: space-between;
            padding-top: 1rem;
          `}
        >
          <TimeComponent
            label={`${t("label-created")} `}
            date={parseISO(courseAudit.created_at)}
            right={false}
            boldLabel
          />
          <TimeComponent
            label={`${t("label-updated")} `}
            boldLabel
            date={parseISO(courseAudit.updated_at)}
            right={true}
          />
        </div>
      </div>
    </div>
  )
}

export default CourseAuditCard

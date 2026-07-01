"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import ContentArea from "./ContentArea"

import type { CourseToAuditUpdate } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/dialogs/Dialog"

interface CourseAuditingUpdateModelProps {
  onChange: (key: string) => (value: string) => void
  course: CourseToAuditUpdate
  handleSubmit(): Promise<void>
  handleClose(): void
  open: boolean
}

const COURSE_DESCRIPTION = "description"
const COURSE_UH_COURSE_CODE = "uh_course_code"

// TODO: translations, update edit fields to new?
const CourseAuditingUpdateModal: React.FC<
  React.PropsWithChildren<CourseAuditingUpdateModelProps>
> = ({ open, handleClose, course, onChange, handleSubmit }) => {
  const { t } = useTranslation()
  return (
    <Dialog
      className={css`
        display: flex;
        align-items: center;
        justify-content: center;
      `}
      open={open}
      onClose={handleClose}
      aria-labelledby="simple-modal-title"
      aria-describedby="simple-modal-description"
      noPadding
    >
      <div
        className={css`
          padding: 16px;
        `}
      >
        <h1>{t("button-text-create")}</h1>
        <div
          className={css`
            padding: 16px 0px 16px;
          `}
        >
          <ContentArea
            title={t("text-field-label-name")}
            text={course.description}
            editing={true}
            onChange={onChange(COURSE_DESCRIPTION)}
            type={"text"}
          />
          <ContentArea
            title={t("text-field-label-or-header-slug-or-short-name")}
            text={course.uh_course_code}
            editing={true}
            onChange={onChange(COURSE_UH_COURSE_CODE)}
            type={"text"}
          />
        </div>

        <Button variant="primary" size="medium" onClick={handleSubmit}>
          {t("button-text-create")}
        </Button>
        <Button variant="secondary" size="medium" onClick={handleClose}>
          {t("button-text-cancel")}
        </Button>
      </div>
    </Dialog>
  )
}

export default CourseAuditingUpdateModal

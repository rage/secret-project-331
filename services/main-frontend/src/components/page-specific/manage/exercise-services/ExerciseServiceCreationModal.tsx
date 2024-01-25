import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { ExerciseServiceNewOrUpdate } from "../../../../shared-module/common/bindings"
import Button from "../../../../shared-module/common/components/Button"
import Dialog from "../../../../shared-module/common/components/Dialog"
import { validURL } from "../../../../shared-module/common/utils/validation"

import ContentArea from "./ContentArea"
interface ExerciseServiceCreationModelProps {
  onChange: (key: string) => (value: string) => void
  onChangeName: (value: string) => void
  exercise_service: ExerciseServiceNewOrUpdate
  handleSubmit(): Promise<void>
  handleClose(): void
  open: boolean
}

const EXERCISE_SERVICE_SLUG = "slug"
const SERVICE_PUBLIC_URL = "public_url"
const SERVICE_INTERNAL_URL = "internal_url"
const MAX_REPROCESSING_SUBMISSION_AT_ONCE = "max_reprocessing_submissions_at_once"

const ExerciseServiceCreationModal: React.FC<
  React.PropsWithChildren<ExerciseServiceCreationModelProps>
> = ({ open, handleClose, exercise_service, onChange, onChangeName, handleSubmit }) => {
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
            text={exercise_service.name}
            editing={true}
            onChange={onChangeName}
            type={"text"}
          />
          <ContentArea
            title={t("text-field-label-or-header-slug-or-short-name")}
            text={exercise_service.slug}
            editing={true}
            onChange={onChange(EXERCISE_SERVICE_SLUG)}
            type={"text"}
          />
          <ContentArea
            title={t("title-public-url")}
            text={exercise_service.public_url}
            editing={true}
            onChange={onChange(SERVICE_PUBLIC_URL)}
            type={"text"}
            error={!validURL(exercise_service.public_url) ? t("error-title") : undefined}
          />
          <ContentArea
            title={t("title-internal-url")}
            text={exercise_service.internal_url}
            editing={true}
            onChange={onChange(SERVICE_INTERNAL_URL)}
            type={"text"}
          />
          <ContentArea
            title={t("title-reprocessing-submissions")}
            text={exercise_service.max_reprocessing_submissions_at_once}
            editing={true}
            onChange={onChange(MAX_REPROCESSING_SUBMISSION_AT_ONCE)}
            type={"number"}
            error={
              exercise_service.max_reprocessing_submissions_at_once < 0
                ? t("error-title")
                : undefined
            }
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

export default ExerciseServiceCreationModal

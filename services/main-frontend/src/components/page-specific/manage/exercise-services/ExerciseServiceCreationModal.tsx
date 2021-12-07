import { css } from "@emotion/css"
import { Card, CardContent, CardHeader, Modal } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"

import { ExerciseServiceNewOrUpdate } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import { validURL } from "../../../../shared-module/utils/validation"

import ContentArea from "./ContentArea"
interface ExerciseServiceCreationModelProps {
  onChange: (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => void
  onChangeName: (event: React.ChangeEvent<HTMLInputElement>) => void
  exercise_service: ExerciseServiceNewOrUpdate
  handleSubmit(): Promise<void>
  handleClose(): void
  open: boolean
}

const ExerciseServiceCreationModal: React.FC<ExerciseServiceCreationModelProps> = ({
  open,
  handleClose,
  exercise_service,
  onChange,
  onChangeName,
  handleSubmit,
}) => {
  const { t } = useTranslation()
  return (
    <Modal
      className={css`
        display: flex;
        align-items: center;
        justify-content: center;
      `}
      open={open}
      onClose={handleClose}
      aria-labelledby="simple-modal-title"
      aria-describedby="simple-modal-description"
    >
      <Card
        className={css`
          width: 60%;
        `}
      >
        <CardHeader title={t("button-text-create")} />
        <CardContent>
          <ContentArea
            title={t("text-field-label-name")}
            text={exercise_service.name}
            editing={true}
            onChange={onChangeName}
            type={"text"}
            error={false}
          />
          <ContentArea
            title={t("text-field-label-or-header-slug-or-short-name")}
            text={exercise_service.slug}
            editing={true}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("slug")}
            type={"text"}
            error={false}
          />
          <ContentArea
            title={t("title-public-url")}
            text={exercise_service.public_url}
            editing={true}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("public_url")}
            type={"text"}
            error={!validURL(exercise_service.public_url)}
          />
          <ContentArea
            title={t("title-internal-url")}
            text={exercise_service.internal_url}
            editing={true}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("internal_url")}
            type={"text"}
            error={!validURL(exercise_service.internal_url ?? "")}
          />
          <ContentArea
            title={t("title-reprocessing-submissions")}
            text={exercise_service.max_reprocessing_submissions_at_once}
            editing={true}
            // eslint-disable-next-line i18next/no-literal-string
            onChange={onChange("max_reprocessing_submissions_at_once")}
            type={"number"}
            error={exercise_service.max_reprocessing_submissions_at_once < 0}
          />
        </CardContent>
        <CardContent>
          <Button variant="primary" size="medium" onClick={handleSubmit}>
            {t("button-text-create")}
          </Button>
          <Button variant="secondary" size="medium" onClick={handleClose}>
            {t("button-text-cancel")}
          </Button>
        </CardContent>
      </Card>
    </Modal>
  )
}

export default ExerciseServiceCreationModal

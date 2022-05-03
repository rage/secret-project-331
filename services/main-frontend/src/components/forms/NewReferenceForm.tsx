import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { NewMaterialReference } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import TextAreaField from "../../shared-module/components/InputFields/TextAreaField"

interface NewReferenceFormProps {
  courseId: string
  onCreateNewReference: (form: NewMaterialReference) => void
  onCancel: () => void
}

interface NewReferenceFields {
  reference: string
}

const REFERENCE = "Bibtex reference"
const NewReferenceForm: React.FC<NewReferenceFormProps> = ({
  courseId,
  onCreateNewReference,
  onCancel,
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewReferenceFields>()

  const onCreateNewReferenceWrapper = handleSubmit((data) => {
    onCreateNewReference({
      citation_key: data.citation_key,
      reference: data.reference,
    })
  })

  return (
    <div>
      <form
        onSubmit={onCreateNewReferenceWrapper}
        className={css`
          width: 25rem;
        `}
      >
        <TextAreaField
          id={"reference"}
          error={errors["reference"]}
          placeholder={REFERENCE}
          register={register}
        />
        <br />
        <Button variant="primary" size="medium" type="submit" value={t("button-text-submit")}>
          {t("button-text-submit")}
        </Button>
        <Button variant="secondary" size="medium" type="button" onClick={onCancel}>
          {t("button-text-close")}
        </Button>
      </form>
    </div>
  )
}

export default NewReferenceForm

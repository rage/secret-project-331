import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { MaterialReference, NewMaterialReference } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import TextAreaField from "../../shared-module/components/InputFields/TextAreaField"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Cite = require("citation-js")

const REFERENCE = "Reference"

interface EditReferenceFormProps {
  onEdit: (courseId: string, id: string, reference: NewMaterialReference) => void
  onDelete: (courseId: string, id: string) => void
  onCancel: () => void
  reference: MaterialReference
  courseId: string
}

interface EditReferenceFields {
  reference: string
}

const EMPTY_STRING = ""
const ErrorText = styled.p`
  color: red;
`

const EditReferenceForm: React.FC<React.PropsWithChildren<EditReferenceFormProps>> = ({
  onEdit,
  onDelete,
  onCancel,
  reference,
  courseId,
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditReferenceFields>()

  const [errorMessage, setErrorMessage] = useState("")

  const onEditReferenceWrapper = handleSubmit((data) => {
    try {
      const cite = new Cite(data.reference)
      const editedReference = cite.data[0]
      onEdit(courseId, reference.id, {
        reference: data.reference,
        citation_key: editedReference.id,
      })
    } catch (error: unknown) {
      console.log(error)
      setErrorMessage(t("reference-parsing-error"))
      setTimeout(() => {
        setErrorMessage(EMPTY_STRING)
      }, 5000)
    }
  })

  let defaultValueReference: string = reference.reference
  try {
    const cite = new Cite(reference.reference)
    defaultValueReference = cite.get({ type: "string", style: "bibtex", lang: "en-US" })
  } catch (error: unknown) {
    console.log(error)
  }

  return (
    <form
      onSubmit={onEditReferenceWrapper}
      className={css`
        width: 100%;
      `}
    >
      <TextAreaField
        label={REFERENCE}
        id={"reference"}
        error={errors["reference"]}
        placeholder={REFERENCE}
        {...register("reference", { required: true })}
        defaultValue={defaultValueReference}
        largeTextarea
        className={css`
          width: 100%;
          margin-bottom: 0.5rem;
          height: 150px;
        `}
      />
      <br />
      {errorMessage && <ErrorText> {errorMessage} </ErrorText>}
      <Button variant="primary" size="medium" type="submit">
        {t("save")}
      </Button>
      <Button
        variant="primary"
        size="medium"
        type="button"
        onClick={() => onDelete(courseId, reference.id)}
      >
        {t("delete")}
      </Button>
      <Button variant="secondary" size="medium" type="button" onClick={onCancel}>
        {t("close")}
      </Button>
    </form>
  )
}

export default EditReferenceForm

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  areCitationsValid,
  safeParseReferences,
  useCitataionLabelsThatWillChange,
} from "./NewReferenceForm"

import { MaterialReference, NewMaterialReference } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"

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
    watch,
  } = useForm<EditReferenceFields>({ defaultValues: { reference: reference.reference } })

  const watchedReference = watch("reference")

  const citationLabelsThatWillChange = useCitataionLabelsThatWillChange(watchedReference)

  const isValidReference = React.useMemo(() => {
    return areCitationsValid(watchedReference)
  }, [watchedReference])

  const onEditReferenceWrapper = handleSubmit((data) => {
    try {
      const cite = safeParseReferences(data.reference)
      const referenceData = cite.data[0]
      const editedReference = new Cite(referenceData)
      onEdit(courseId, reference.id, {
        reference: editedReference.get({ type: "string", style: "bibtex", lang: "en-US" }),
        citation_key: referenceData.id,
      })
    } catch (error: unknown) {
      console.error(error)
    }
  })

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
        rows={5}
        className={css`
          width: 100%;
          margin-bottom: 0.5rem;
        `}
        autoResize
      />
      <br />
      {!isValidReference && <ErrorText> {t("reference-parsing-error")} </ErrorText>}
      {citationLabelsThatWillChange.map((c) => (
        <ErrorText key={c.original}>
          {t("reference-parsing-error-label-change", { original: c.original, safe: c.safe })}
        </ErrorText>
      ))}
      <Button variant="primary" size="medium" type="submit">
        {t("save")}
      </Button>
      <Button
        variant="secondary"
        size="medium"
        type="button"
        onClick={() => onDelete(courseId, reference.id)}
      >
        {t("delete")}
      </Button>
    </form>
  )
}

export default EditReferenceForm

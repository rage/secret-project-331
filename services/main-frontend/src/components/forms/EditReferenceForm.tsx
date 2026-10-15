"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
// @ts-expect-error: No type definitions
import Cite from "citation-js"
import { useEffect, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { MaterialReference, NewMaterialReference } from "@/generated/api/types.generated"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { TextArea } from "@/shared-module/components"

import {
  areCitationsValid,
  detectCitationLabelsThatWillChange,
  safeParseReferences,
} from "./NewReferenceForm"

// Shared with EditReferenceDialog.tsx, whose footer submit button targets this form by id.
export const EDIT_REFERENCE_FORM_ID = "edit-reference-form"

const REFERENCE = "Reference"

interface EditReferenceFormProps {
  onEdit: (courseId: string, id: string, reference: NewMaterialReference) => void
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
  onCancel: _onCancel,
  reference,
  courseId,
}) => {
  const { t } = useTranslation()
  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<EditReferenceFields>({ defaultValues: { reference: reference.reference } })

  // oxlint-disable-next-line i18next/no-literal-string
  const watchedReference = useWatch({ control, name: "reference" })

  const detection = useMemo(() => {
    if (!watchedReference) {
      return { items: [], error: null as null | Error }
    }
    try {
      return { items: detectCitationLabelsThatWillChange(watchedReference), error: null }
    } catch (e) {
      return { items: [], error: e instanceof Error ? e : new Error(t("error-title")) }
    }
  }, [watchedReference, t])

  useEffect(() => {
    if (detection.error && !errors.root) {
      setError("root", { message: detection.error.message })
    } else if (!detection.error && errors.root) {
      clearErrors("root")
    }
  }, [detection.error, errors.root, setError, clearErrors])

  const citationLabelsThatWillChange = detection.items

  const isValidReference = useMemo(() => {
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
      id={EDIT_REFERENCE_FORM_ID}
      onSubmit={onEditReferenceWrapper}
      className={css`
        width: 100%;
      `}
    >
      <TextArea
        name="reference"
        control={control}
        rules={{ required: true }}
        label={REFERENCE}
        id={"reference"}
        rows={5}
        className={css`
          width: 100%;
          margin-bottom: 0.5rem;
        `}
        autoResize
      />
      <br />
      {!isValidReference && <ErrorText> {t("reference-parsing-error")} </ErrorText>}
      {citationLabelsThatWillChange &&
        citationLabelsThatWillChange.map((c) => (
          <ErrorText key={c.original}>
            {t("reference-parsing-error-label-change", { original: c.original, safe: c.safe })}
          </ErrorText>
        ))}
    </form>
  )
}

export default withErrorBoundary(EditReferenceForm)

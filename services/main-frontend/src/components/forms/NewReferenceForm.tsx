import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { NewMaterialReference } from "../../shared-module/common/bindings"
import Button from "../../shared-module/common/components/Button"
import TextAreaField from "../../shared-module/common/components/InputFields/TextAreaField"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Cite = require("citation-js")

interface NewReferenceFormProps {
  onCreateNewReference: (form: NewMaterialReference[]) => void
  onCancel: () => void
}

interface NewReferenceFields {
  references: string
}

const ErrorText = styled.p`
  color: red;
`
const REFERENCE = "Bibtex reference"
const EMPTY_STRING = ""

const NewReferenceForm: React.FC<React.PropsWithChildren<NewReferenceFormProps>> = ({
  onCreateNewReference,
  onCancel,
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewReferenceFields>()

  const [errorMessage, setErrorMessage] = useState("")
  const onCreateNewReferenceWrapper = handleSubmit((data) => {
    try {
      const cite = new Cite(data.references)
      const references = cite.data.map((c: { id: string }) => {
        const ci = new Cite(c)
        return {
          citation_key: c.id,
          reference: ci.get({ type: "string", style: "bibtex", lang: "en-US" }),
        }
      })
      onCreateNewReference(references)
    } catch (error: unknown) {
      setErrorMessage(t("reference-parsing-error"))
      setTimeout(() => {
        setErrorMessage(EMPTY_STRING)
      }, 5000)
    }
  })

  return (
    <form
      onSubmit={onCreateNewReferenceWrapper}
      className={css`
        width: 100%;
      `}
    >
      <TextAreaField
        label={REFERENCE}
        id={"references"}
        error={errors["references"]}
        placeholder={REFERENCE}
        {...register("references", { required: t("required-field") })}
        rows={5}
        className={css`
          width: 100%;
          margin-bottom: 0.5rem;
          height: 150px;
        `}
      />
      {errorMessage && <ErrorText> {errorMessage} </ErrorText>}
      <br />
      <Button variant="primary" size="medium" type="submit" value={t("button-text-submit")}>
        {t("button-text-submit")}
      </Button>
      <Button variant="secondary" size="medium" type="button" onClick={onCancel}>
        {t("button-text-close")}
      </Button>
    </form>
  )
}

export default NewReferenceForm

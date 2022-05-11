import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { NewMaterialReference } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import FormTextAreaField from "../FormTextAreaField"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Cite = require("citation-js")

interface NewReferenceFormProps {
  onCreateNewReference: (form: NewMaterialReference[]) => void
  onCancel: () => void
}

interface NewReferenceFields {
  references: string
}

const REFERENCE = "Bibtex reference"

const NewReferenceForm: React.FC<NewReferenceFormProps> = ({ onCreateNewReference, onCancel }) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewReferenceFields>()

  const onCreateNewReferenceWrapper = handleSubmit((data) => {
    const cite = new Cite(data.references)
    const references = cite.data.map((c: { id: string }) => {
      const ci = new Cite(c)
      return {
        citation_key: c.id,
        reference: ci.get({ type: "string", style: "bibtex", lang: "en-US" }),
      }
    })
    onCreateNewReference(references)
  })

  return (
    <div>
      <form
        onSubmit={onCreateNewReferenceWrapper}
        className={css`
          width: 100%;
        `}
      >
        <FormTextAreaField
          id={"references"}
          error={errors["references"]}
          placeholder={REFERENCE}
          register={register}
          defaultValue={null}
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

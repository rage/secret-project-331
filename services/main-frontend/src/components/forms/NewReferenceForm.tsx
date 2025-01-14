import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { NewMaterialReference } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"

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
    watch,
    formState: { errors },
  } = useForm<NewReferenceFields>()

  const references = watch("references")

  const [errorMessage, setErrorMessage] = useState("")
  const onCreateNewReferenceWrapper = handleSubmit((data) => {
    try {
      const rawCite = new Cite(data.references)
      const cite = new Cite(rawCite.get({ type: "string", style: "bibtex", lang: "en-US" }))
      const references = cite.data.map((c: { id: string; "citation-key": string }) => {
        const ci = new Cite(c)

        return {
          citation_key: c["citation-key"],
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

  const citationLabelsThatWillChange = useCitataionLabelsThatWillChange(references)

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
        `}
        autoResize
      />
      {errorMessage && <ErrorText> {errorMessage} </ErrorText>}
      {citationLabelsThatWillChange.map((c) => (
        <ErrorText key={c.original}>
          {t("reference-parsing-error-label-change", { original: c.original, safe: c.safe })}
        </ErrorText>
      ))}
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
/// Have to construct the citation twice because the library changes the label if it contains any non-safe characters, and we want to persist the safe version of the label
export function safeParseReferences(references: string): typeof Cite {
  const rawCite = new Cite(references)
  const cite = new Cite(rawCite.get({ type: "string", style: "bibtex", lang: "en-US" }))
  return cite
}

/// Can be used to detect if citation.js will change the citation key to a safe version
export function useCitataionLabelsThatWillChange(
  references: string,
): { original: string; safe: string }[] {
  const safeCite = safeParseReferences(references)
  const unsafeCite = new Cite(references)
  const keys = safeCite.data
    .map((c: { "citation-key": string }, i: number) => ({
      original: unsafeCite.data[i]["citation-key"],
      safe: c["citation-key"],
    }))
    .filter((c: { original: string; safe: string }) => c.original !== c.safe)
  return keys
}

export function areCitationsValid(references: string): boolean {
  try {
    const cite = new Cite(references)
    cite.get({ type: "string", style: "bibtex", lang: "en-US" })
    return true
  } catch (error: unknown) {
    return false
  }
}

export default NewReferenceForm

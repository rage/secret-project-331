"use client"

import { css } from "@emotion/css"
import React, { useEffect } from "react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { ExternalGrading } from "@/generated/api/types.generated"
import { Button, Chip, NumberField, Select, TextField } from "@/shared-module/components"

import { BUTTON_SECONDARY, BUTTON_TERTIARY, CREDIT_REGISTRATION_NS } from "../constants"
import { noteCss, subheadingCss } from "../styles"
import { emptyCodeFields, NO_PREREQUISITE } from "./externalCreditTargetCodes"
import type { CodeFields } from "./externalCreditTargetCodes"

export const fieldRowCss = css`
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  align-items: start;
`

const sectionCss = css`
  display: grid;
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-clear-300);
`

const rowCardCss = css`
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-clear-400);
  border-radius: 8px;
`

const rowHeaderCss = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  font-weight: 600;
`

const chipsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
`

const draftRowCss = css`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-3);
  align-items: start;
`

const ENTER_KEY = "Enter"
const PASS_FAIL: ExternalGrading = "pass_fail"
const NUMERIC: ExternalGrading = "numeric"
const VALIDATE_ON_COMMIT = "validate" as const

interface FormShape {
  codes: CodeFields[]
}

/** The Sisu course rows of a mooc.fi target, edited together with the target's own fields. */
const ExternalCreditTargetCodeRows: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { control, watch, setValue, getValues } = useFormContext<FormShape>()
  const { fields, append, remove } = useFieldArray({ control, name: "codes" })
  const rows = watch("codes")

  useEffect(() => {
    const keys = new Set(rows.map((row) => row.key))
    rows.forEach((row, index) => {
      if (row.prerequisite_key !== NO_PREREQUISITE && !keys.has(row.prerequisite_key)) {
        setValue(`codes.${index}.prerequisite_key`, NO_PREREQUISITE)
      }
    })
  }, [rows, setValue])

  const addEquivalentCode = (index: number) => {
    const row = getValues(`codes.${index}`)
    const code = row.equivalent_draft.trim()
    if (code !== "" && !row.equivalent_course_codes.includes(code)) {
      setValue(`codes.${index}.equivalent_course_codes`, [...row.equivalent_course_codes, code])
    }
    setValue(`codes.${index}.equivalent_draft`, "")
  }

  const removeEquivalentCode = (index: number, code: string) =>
    setValue(
      `codes.${index}.equivalent_course_codes`,
      getValues(`codes.${index}.equivalent_course_codes`).filter((other) => other !== code),
    )

  return (
    <section className={sectionCss}>
      <div>
        <h3 className={subheadingCss}>{t("credit-registration-admin-codes-heading")}</h3>
        <p className={noteCss}>{t("credit-registration-admin-codes-description")}</p>
      </div>
      {fields.map((field, index) => {
        const row = rows[index]
        if (!row) {
          return null
        }
        const prerequisiteOptions = [
          {
            value: NO_PREREQUISITE,
            label: t("credit-registration-admin-prerequisite-none"),
          },
          ...rows
            .filter((other) => other.key !== row.key)
            .map((other) => ({
              value: other.key,
              label: t("credit-registration-admin-prerequisite-option", {
                code: other.uh_course_code,
                name: other.name,
              }),
            })),
        ]
        const title =
          row.name.trim() === ""
            ? t("credit-registration-admin-code-untitled", { number: index + 1 })
            : row.name
        return (
          <div key={field.id} role="group" aria-label={title} className={rowCardCss}>
            <div className={rowHeaderCss}>
              <span>{title}</span>
              <Button variant={BUTTON_TERTIARY} size="small" onPress={() => remove(index)}>
                {t("credit-registration-admin-code-remove")}
              </Button>
            </div>
            <div className={fieldRowCss}>
              <TextField
                name={`codes.${index}.uh_course_code`}
                control={control}
                label={t("uh-course-code")}
                isRequired
                rules={{
                  required: t("required-field"),
                  validate: (value) =>
                    getValues("codes").filter(
                      (other) => other.uh_course_code.trim() === value.trim(),
                    ).length === 1 || t("credit-registration-admin-moocfi-course-code-taken"),
                }}
              />
              <TextField
                name={`codes.${index}.name`}
                control={control}
                label={t("credit-registration-admin-code-name")}
                isRequired
                rules={{ required: t("required-field") }}
              />
            </div>
            <div className={fieldRowCss}>
              <NumberField
                name={`codes.${index}.minimum_tier`}
                control={control}
                label={t("label-minimum-tier")}
                minValue={1}
                step={1}
                description={t("credit-registration-admin-minimum-tier-description")}
              />
              <NumberField
                name={`codes.${index}.ects_credits`}
                control={control}
                label={t("ects-credits")}
                minValue={0}
                step={0.5}
                commitBehavior={VALIDATE_ON_COMMIT}
                isRequired
                rules={{
                  validate: (value) =>
                    (value !== null && value > 0) || t("credit-registration-admin-ects-positive"),
                }}
              />
              <Select
                name={`codes.${index}.grading`}
                control={control}
                label={t("label-grading")}
                options={[
                  {
                    value: PASS_FAIL,
                    label: t("credit-registration-admin-grading-pass-fail"),
                  },
                  {
                    value: NUMERIC,
                    label: t("credit-registration-admin-grading-numeric"),
                  },
                ]}
              />
            </div>
            <TextField
              name={`codes.${index}.enrolment_link`}
              control={control}
              type="url"
              label={t("label-enrolment-link")}
              description={t("credit-registration-admin-moocfi-enrolment-link-description")}
            />
            <div className={fieldRowCss}>
              <Select
                name={`codes.${index}.prerequisite_key`}
                control={control}
                label={t("label-prerequisite")}
                description={t("credit-registration-admin-prerequisite-description")}
                options={prerequisiteOptions}
              />
              <div
                role="presentation"
                onKeyDown={(event) => {
                  if (event.key === ENTER_KEY) {
                    event.preventDefault()
                    addEquivalentCode(index)
                  }
                }}
              >
                <p className={noteCss}>{t("label-equivalent-codes")}</p>
                {row.equivalent_course_codes.length > 0 && (
                  <div className={chipsCss}>
                    {row.equivalent_course_codes.map((code) => (
                      <Chip
                        key={code}
                        onRemove={() => removeEquivalentCode(index, code)}
                        removeLabel={t("credit-registration-admin-equivalent-code-remove", {
                          code,
                        })}
                      >
                        {code}
                      </Chip>
                    ))}
                  </div>
                )}
                <div className={draftRowCss}>
                  <TextField
                    name={`codes.${index}.equivalent_draft`}
                    control={control}
                    label={t("credit-registration-admin-equivalent-code-draft")}
                    description={t("credit-registration-admin-equivalent-codes-description")}
                  />
                  <Button
                    variant={BUTTON_SECONDARY}
                    size="medium"
                    onPress={() => addEquivalentCode(index)}
                  >
                    {t("credit-registration-admin-equivalent-code-add")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <div>
        <Button variant={BUTTON_TERTIARY} size="medium" onPress={() => append(emptyCodeFields())}>
          {t("credit-registration-admin-code-add")}
        </Button>
      </div>
    </section>
  )
}

export default ExternalCreditTargetCodeRows

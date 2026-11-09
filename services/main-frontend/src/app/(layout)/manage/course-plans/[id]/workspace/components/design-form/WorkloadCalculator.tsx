"use client"

import { css } from "@emotion/css"
import { Plus, Trash } from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import { useEffect, useRef } from "react"
import { type Control, useFieldArray, type UseFormSetValue, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { DesignWorkloadActivityType } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Button, NumberField, Select, TextField } from "@/shared-module/components"

import {
  defaultMinutesFor,
  type DesignFormValues,
  HOURS_PER_CREDIT,
  MAX_WORKLOAD_AMOUNT,
  newWorkloadActivity,
  totalWorkloadMinutes,
  WORKLOAD_ACTIVITY_TYPES,
} from "./designFormDomain"
import { designListStyles, ICON_SIZE_BUTTON } from "./designFormStyles"

const rowStyles = css`
  display: grid;
  gap: 0.5rem;
  align-items: start;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.clear[50]};
`

const rowFieldsStyles = css`
  display: grid;
  gap: 0.5rem;
  grid-template-columns: minmax(0, 1fr);

  ${respondToOrLarger.md} {
    grid-template-columns: minmax(0, 2fr) minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  }
`

const rowTotalStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
  grid-column: 1 / -1;
`

const summaryStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: ${baseTheme.colors.green[50]};
  border: 1px solid ${baseTheme.colors.green[200]};
  color: ${baseTheme.colors.gray[800]};
  font-size: 0.95rem;
  margin: 0;
`

const summaryValueStyles = css`
  font-weight: 600;
`

const footnoteStyles = css`
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.5;
  margin: 0;
`

function buildAmountRules(t: TFunction) {
  return {
    validate: (value: unknown) =>
      value === null ||
      (typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= MAX_WORKLOAD_AMOUNT) ||
      t("course-plans-design-workload-amount-invalid", { max: MAX_WORKLOAD_AMOUNT }),
  }
}

function formatHours(minutes: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(minutes / 60)
}

function WorkloadActivityRow(props: {
  control: Control<DesignFormValues>
  setValue: UseFormSetValue<DesignFormValues>
  index: number
  onRemove: () => void
}) {
  const { control, setValue, index, onRemove } = props
  const { t, i18n } = useTranslation()
  const activityType = useWatch({ control, name: `workload_activities.${index}.activity_type` })
  const count = useWatch({ control, name: `workload_activities.${index}.count` })
  const minutesEach = useWatch({ control, name: `workload_activities.${index}.minutes_each` })
  const previousTypeRef = useRef<DesignWorkloadActivityType>(activityType)

  // Picking another type replaces the time only while it still is the old type's default.
  useEffect(() => {
    const previousType = previousTypeRef.current
    previousTypeRef.current = activityType
    if (previousType === activityType) {
      return
    }
    if (minutesEach === null || minutesEach === defaultMinutesFor(previousType)) {
      setValue(`workload_activities.${index}.minutes_each`, defaultMinutesFor(activityType), {
        shouldDirty: true,
      })
    }
  }, [activityType, minutesEach, index, setValue])

  const amountRules = buildAmountRules(t)
  const rowMinutes = (count ?? 0) * (minutesEach ?? 0)
  const position = index + 1

  return (
    <div className={rowStyles}>
      <div className={rowFieldsStyles}>
        <TextField
          name={`workload_activities.${index}.title`}
          control={control}
          label={t("course-plans-design-workload-activity-title", { number: position })}
        />
        <Select
          name={`workload_activities.${index}.activity_type`}
          control={control}
          label={t("course-plans-design-workload-activity-type")}
          options={WORKLOAD_ACTIVITY_TYPES.map((entry) => ({
            value: entry.type,
            label: t(entry.labelKey),
          }))}
        />
        <NumberField
          name={`workload_activities.${index}.count`}
          control={control}
          rules={amountRules}
          label={t("course-plans-design-workload-count")}
          minValue={0}
          maxValue={MAX_WORKLOAD_AMOUNT}
          step={1}
        />
        <NumberField
          name={`workload_activities.${index}.minutes_each`}
          control={control}
          rules={amountRules}
          label={t("course-plans-design-workload-minutes-each")}
          minValue={0}
          maxValue={MAX_WORKLOAD_AMOUNT}
          step={1}
        />
        <p className={rowTotalStyles}>
          {t("course-plans-design-workload-row-total", {
            hours: formatHours(rowMinutes, i18n.language),
          })}
        </p>
      </div>
      <Button
        type="button"
        variant="icon"
        size="small"
        icon={<Trash size={ICON_SIZE_BUTTON} />}
        aria-label={t("course-plans-design-workload-remove", { number: position })}
        onClick={onRemove}
      />
    </div>
  )
}

/** Student workload estimate from planned activities, compared with the credits from Analysis. */
export default function WorkloadCalculator(props: {
  control: Control<DesignFormValues>
  setValue: UseFormSetValue<DesignFormValues>
  credits: number | null | undefined
}) {
  const { control, setValue, credits } = props
  const { t, i18n } = useTranslation()
  const { fields, append, remove } = useFieldArray({
    control,
    name: "workload_activities",
    keyName: "fieldKey",
  })
  const activities = useWatch({ control, name: "workload_activities" })
  const totalMinutes = totalWorkloadMinutes(activities)
  const hasCredits = typeof credits === "number" && credits > 0

  return (
    <div className={designListStyles}>
      {fields.map((field, index) => (
        <WorkloadActivityRow
          key={field.fieldKey}
          control={control}
          setValue={setValue}
          index={index}
          onRemove={() => remove(index)}
        />
      ))}
      <div>
        <Button
          type="button"
          variant="tertiary"
          size="small"
          icon={<Plus size={ICON_SIZE_BUTTON} />}
          onClick={() => append(newWorkloadActivity())}
        >
          {t("course-plans-design-workload-add")}
        </Button>
      </div>
      <p className={summaryStyles} role="status">
        <span>
          {t("course-plans-design-workload-total")}{" "}
          <span className={summaryValueStyles}>
            {t("course-plans-design-workload-hours", {
              hours: formatHours(totalMinutes, i18n.language),
            })}
          </span>
        </span>
        <span>
          {hasCredits ? (
            <>
              {t("course-plans-design-workload-target", { credits })}{" "}
              <span className={summaryValueStyles}>
                {t("course-plans-design-workload-hours", {
                  hours: formatHours(credits * HOURS_PER_CREDIT * 60, i18n.language),
                })}
              </span>
            </>
          ) : (
            t("course-plans-design-workload-no-credits")
          )}
        </span>
      </p>
      <p className={footnoteStyles}>{t("course-plans-design-workload-footnote")}</p>
    </div>
  )
}

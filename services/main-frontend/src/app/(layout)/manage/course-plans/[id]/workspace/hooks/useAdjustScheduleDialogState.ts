import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

/** Single source of truth for extend-months value in the adjust-schedule dialog. */
export function useAdjustScheduleDialogState(initialMonths = 1) {
  const { t } = useTranslation()
  const { control, setValue, watch } = useForm<{ extendMonths: string }>({
    defaultValues: { extendMonths: String(initialMonths) },
  })

  const extendMonths = Number(watch("extendMonths")) || initialMonths

  const extendMonthsOptions = useMemo(
    () =>
      Array.from({ length: 6 }, (_item, index) => {
        const months = index + 1
        return {
          value: String(months),
          label: t("course-plans-adjust-schedule-month-option", { count: months }),
        }
      }),
    [t],
  )

  const resetExtendMonths = () => {
    setValue("extendMonths", String(initialMonths))
  }

  return {
    control,
    extendMonths: Number.isFinite(extendMonths) && extendMonths > 0 ? extendMonths : initialMonths,
    extendMonthsOptions,
    resetExtendMonths,
  }
}

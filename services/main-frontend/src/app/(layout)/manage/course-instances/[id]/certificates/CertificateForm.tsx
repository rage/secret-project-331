"use client"

import { css } from "@emotion/css"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type {
  CertificateConfigurationAndRequirements,
  CertificateTextAnchor,
  PaperSize,
} from "@/generated/api/types.generated"
import MaskOverThisInSystemTests from "@/shared-module/common/components/system-tests/MaskOverThisInSystemTests"
import SetHeightInSystemTests from "@/shared-module/common/components/system-tests/SetHeightInSystemTests"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, Checkbox, FileField, Select, TextField } from "@/shared-module/components"

interface Props {
  generatingCertificatesEnabled: boolean
  configurationAndRequirements: CertificateConfigurationAndRequirements | null
  onClickSave: (fields: CertificateFields) => void
  onClickCancel: () => void
}

export interface CertificateFields {
  ownerNamePosX: string
  ownerNamePosY: string
  ownerNameFontSize: string
  ownerNameTextColor: string
  ownerNameTextAnchor: CertificateTextAnchor
  validateUrlPosX: string
  validateUrlPosY: string
  validateUrlFontSize: string
  validateUrlTextColor: string
  validateUrlTextAnchor: CertificateTextAnchor
  datePosX: string
  datePosY: string
  dateFontSize: string
  dateTextColor: string
  dateTextAnchor: CertificateTextAnchor
  locale: string
  paperSize: PaperSize
  backgroundSvg: File[]
  overlaySvg: File[]
  clearCurrentOverlaySvg: boolean
  renderGrade: boolean
  gradePosX: string | null
  gradePosY: string | null
  gradeFontSize: string | null
  gradeTextColor: string | null
  gradeTextAnchor: CertificateTextAnchor | null
}

const ANCHOR_OPTIONS: { value: CertificateTextAnchor; label: string }[] = [
  { value: "start", label: "Start" },
  { value: "middle", label: "Middle" },
  { value: "end", label: "End" },
]
const PAPER_SIZE_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "vertical-a4", label: "Vertical A4" },
  { value: "horizontal-a4", label: "Horizontal A4" },
]

const CertificateForm: React.FC<Props> = ({
  configurationAndRequirements,
  onClickSave,
  onClickCancel,
}) => {
  const configuration = configurationAndRequirements?.certificate_configuration
  const { t } = useTranslation()
  /* oxlint-disable i18next/no-literal-string */
  const { control, handleSubmit } = useForm<CertificateFields>({
    mode: "onChange",
    defaultValues: {
      ownerNamePosX: configuration?.certificate_owner_name_x_pos ?? "50%",
      ownerNamePosY: configuration?.certificate_owner_name_y_pos ?? "70%",
      ownerNameFontSize: configuration?.certificate_owner_name_font_size ?? "150px",
      ownerNameTextColor: configuration?.certificate_owner_name_text_color ?? "black",
      ownerNameTextAnchor: configuration?.certificate_owner_name_text_anchor ?? "middle",
      validateUrlPosY: configuration?.certificate_validate_url_y_pos ?? "88.5%",
      validateUrlPosX: configuration?.certificate_validate_url_x_pos ?? "80%",
      validateUrlFontSize: configuration?.certificate_validate_url_font_size ?? "30px",
      validateUrlTextColor: configuration?.certificate_validate_url_text_color ?? "black",
      validateUrlTextAnchor: configuration?.certificate_validate_url_text_anchor ?? "end",
      datePosY: configuration?.certificate_date_y_pos ?? "88.5%",
      datePosX: configuration?.certificate_date_x_pos ?? "15%",
      dateFontSize: configuration?.certificate_date_font_size ?? "30px",
      dateTextColor: configuration?.certificate_date_text_color ?? "black",
      dateTextAnchor: configuration?.certificate_date_text_anchor ?? "start",
      locale: configuration?.certificate_locale ?? "en",
      paperSize: configuration?.paper_size ?? "horizontal-a4",
      backgroundSvg: [],
      overlaySvg: [],
      clearCurrentOverlaySvg: false,
      renderGrade: configuration?.render_certificate_grade ?? false,
      gradePosX: configuration?.certificate_grade_x_pos ?? null,
      gradePosY: configuration?.certificate_grade_y_pos ?? null,
      gradeFontSize: configuration?.certificate_grade_font_size ?? null,
      gradeTextColor: configuration?.certificate_grade_text_color ?? null,
      gradeTextAnchor: configuration?.certificate_grade_text_anchor ?? null,
    },
  })
  /* oxlint-enable i18next/no-literal-string */
  const onSubmitWrapper = handleSubmit((data) => {
    onClickSave(data)
  })

  const { control: gradeToggleControl, watch: watchGradeToggle } = useForm<{
    enableGrade: boolean
  }>({
    defaultValues: { enableGrade: !!configuration?.certificate_grade_x_pos },
  })
  // oxlint-disable-next-line i18next/no-literal-string
  const showGradeFields = watchGradeToggle("enableGrade")

  return (
    <form
      onSubmit={onSubmitWrapper}
      className={css`
        hr {
          color: ${baseTheme.colors.clear[300]};
        }
      `}
    >
      <TextField
        id={"locale"}
        name="locale"
        control={control}
        label={t("label-locale")}
        rules={{ required: t("required-field") }}
      />
      <Select
        id={"paperSize"}
        name="paperSize"
        control={control}
        options={PAPER_SIZE_OPTIONS}
        label={t("label-paper-size")}
      />
      <MaskOverThisInSystemTests useDisplayBlockAndHideOverflow>
        <SetHeightInSystemTests heightPx={100}>
          <FileField
            id={"backgroundSvg"}
            name="backgroundSvg"
            control={control}
            label={
              configuration
                ? t("label-background-svg-current", { path: configuration.background_svg_path })
                : t("label-background-svg")
            }
            rules={configuration ? undefined : { required: t("required-field") }}
            isRequired={configuration === null}
          />
          <FileField
            id={"overlaySvg"}
            name="overlaySvg"
            control={control}
            label={
              configuration
                ? configuration.overlay_svg_path
                  ? t("label-overlay-svg-current", { path: configuration.overlay_svg_path })
                  : t("label-overlay-svg-optional")
                : t("label-overlay-svg")
            }
          />
        </SetHeightInSystemTests>
      </MaskOverThisInSystemTests>
      <Checkbox
        id={"clearCurrentOverlaySvg"}
        name="clearCurrentOverlaySvg"
        control={control}
        label={t("label-delete-current-overlay-svg")}
        isDisabled={configuration?.overlay_svg_path === null}
      />
      <hr />
      <div>
        <h3>{t("certificate-owner-name")}</h3>
        <TextField
          id={"ownerNamePosX"}
          name="ownerNamePosX"
          control={control}
          label={t("label-position-x")}
          rules={{ required: t("required-field") }}
        />
        <TextField
          id={"ownerNamePosY"}
          name="ownerNamePosY"
          control={control}
          label={t("label-position-y")}
          rules={{ required: t("required-field") }}
        />
        <TextField
          id={"ownerNameFontSize"}
          name="ownerNameFontSize"
          control={control}
          label={t("label-font-size")}
          rules={{ required: t("required-field") }}
        />
        <TextField
          id={"ownerNameTextColor"}
          name="ownerNameTextColor"
          control={control}
          label={t("label-text-color")}
          rules={{ required: t("required-field") }}
        />
        <Select
          id={"ownerNameTextAnchor"}
          name="ownerNameTextAnchor"
          control={control}
          options={ANCHOR_OPTIONS}
          label={t("label-text-anchor")}
        />
      </div>
      <hr />
      <div>
        <h3>{t("certificate-validation-url")}</h3>
        <TextField
          id={"validateUrlPosX"}
          name="validateUrlPosX"
          control={control}
          label={t("label-position-x")}
          rules={{ required: t("required-field") }}
        />
        <TextField
          id={"validateUrlPosY"}
          name="validateUrlPosY"
          control={control}
          label={t("label-position-y")}
          rules={{ required: t("required-field") }}
        />
        <TextField
          id={"validateUrlFontSize"}
          name="validateUrlFontSize"
          control={control}
          label={t("label-font-size")}
          rules={{ required: t("required-field") }}
        />
        <TextField
          id={"validateUrlTextColor"}
          name="validateUrlTextColor"
          control={control}
          label={t("label-text-color")}
          rules={{ required: t("required-field") }}
        />
        <Select
          id={"validateUrlTextAnchor"}
          name="validateUrlTextAnchor"
          control={control}
          options={ANCHOR_OPTIONS}
          label={t("label-text-anchor")}
        />
      </div>
      <hr />
      <div>
        <h3>{t("date")}</h3>
        <TextField
          id={"datePosX"}
          name="datePosX"
          control={control}
          label={t("label-position-x")}
          rules={{ required: t("required-field") }}
        />
        <TextField
          id={"datePosY"}
          name="datePosY"
          control={control}
          label={t("label-position-y")}
          rules={{ required: t("required-field") }}
        />
        <TextField
          id={"dateFontSize"}
          name="dateFontSize"
          control={control}
          label={t("label-font-size")}
          rules={{ required: t("required-field") }}
        />
        <TextField
          id={"dateTextColor"}
          name="dateTextColor"
          control={control}
          label={t("label-text-color")}
          rules={{ required: t("required-field") }}
        />
        <Select
          id={"dateTextAnchor"}
          name="dateTextAnchor"
          control={control}
          options={ANCHOR_OPTIONS}
          label={t("label-text-anchor")}
        />
      </div>
      <hr />
      <Checkbox
        id="enableGrade"
        name="enableGrade"
        control={gradeToggleControl}
        label={t("label-grade")}
      />
      {showGradeFields && (
        <>
          <hr />
          <Checkbox
            id="renderGrade"
            name="renderGrade"
            control={control}
            label={t("label-show-grade-in-cerfiticate")}
          />
          <div>
            <h3>{t("grade")}</h3>
            <TextField
              id={"gradePosX"}
              name="gradePosX"
              control={control}
              label={t("label-position-x")}
              rules={{ required: t("required-field") }}
            />
            <TextField
              id={"gradePosY"}
              name="gradePosY"
              control={control}
              label={t("label-position-y")}
              rules={{ required: t("required-field") }}
            />
            <TextField
              id={"gradeFontSize"}
              name="gradeFontSize"
              control={control}
              label={t("label-font-size")}
              rules={{ required: t("required-field") }}
            />
            <TextField
              id={"gradeTextColor"}
              name="gradeTextColor"
              control={control}
              label={t("label-text-color")}
              rules={{ required: t("required-field") }}
            />
            <Select
              id={"gradeTextAnchor"}
              name="gradeTextAnchor"
              control={control}
              options={ANCHOR_OPTIONS}
              label={t("label-text-anchor")}
            />
          </div>
        </>
      )}
      <Button variant="primary" size="medium" type="submit">
        {t("button-text-save")}
      </Button>
      <Button variant="secondary" size="medium" type="button" onClick={onClickCancel}>
        {t("button-text-cancel")}
      </Button>
    </form>
  )
}

export default CertificateForm

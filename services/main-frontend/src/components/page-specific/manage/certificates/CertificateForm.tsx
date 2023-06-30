import { css } from "@emotion/css"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  CertificateTextAnchor,
  CourseModuleCertificateConfiguration,
  PaperSize,
} from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import CheckBox from "../../../../shared-module/components/InputFields/CheckBox"
import FileField from "../../../../shared-module/components/InputFields/FileField"
import SelectField from "../../../../shared-module/components/InputFields/SelectField"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import MaskOverThisInSystemTests from "../../../../shared-module/components/system-tests/MaskOverThisInSystemTests"
import { baseTheme } from "../../../../shared-module/styles"

interface Props {
  generatingCertificatesEnabled: boolean
  configuration: CourseModuleCertificateConfiguration | null
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
  backgroundSvg: FileList
  overlaySvg: FileList
  clearCurrentOverlaySvg: boolean
}

const CertificateForm: React.FC<Props> = ({ configuration, onClickSave, onClickCancel }) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CertificateFields>({
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
      backgroundSvg: undefined,
      overlaySvg: undefined,
      clearCurrentOverlaySvg: false,
    },
  })
  const onSubmitWrapper = handleSubmit((data) => {
    onClickSave(data)
  })

  const anchorOptions: { value: CertificateTextAnchor; label: string }[] = [
    { value: "start", label: "Start" },
    { value: "middle", label: "Middle" },
    { value: "end", label: "End" },
  ]
  const paperSizeOptions: { value: PaperSize; label: string }[] = [
    { value: "vertical-a4", label: "Vertical A4" },
    { value: "horizontal-a4", label: "Horizontal A4" },
  ]
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
        error={errors.locale}
        label={"Locale"}
        {...register("locale", { required: t("required-field") })}
      />
      <SelectField
        id={"paperSize"}
        options={paperSizeOptions}
        label="Paper size"
        {...register("paperSize")}
      />
      <MaskOverThisInSystemTests>
        <FileField
          id={"backgroundSvg"}
          error={errors.backgroundSvg}
          label={
            configuration
              ? `Background SVG (currently ${configuration.background_svg_path})`
              : `Background SVG`
          }
          {...register(
            "backgroundSvg",
            // required if configuration does not exist yet
            configuration ? undefined : { required: t("required-field") },
          )}
          // required for new configurations
          required={configuration === null}
          accept={".svg"}
        />
        <FileField
          id={"overlaySvg"}
          error={errors.overlaySvg}
          label={
            configuration
              ? configuration.overlay_svg_path
                ? `Overlay SVG (currently ${configuration.overlay_svg_path})`
                : "Overlay SVG (optional, currently not set)"
              : "Overlay SVG"
          }
          {...register("overlaySvg")}
          accept={".svg"}
        />
      </MaskOverThisInSystemTests>
      <CheckBox
        id={"clearCurrentOverlaySvg"}
        label={"Delete current overlay SVG"}
        {...register("clearCurrentOverlaySvg")}
        // disabled if no current overlay SVG
        disabled={configuration?.overlay_svg_path === null}
      />
      <hr />
      <div>
        <h3>{t("certificate-owner-name")}</h3>
        <TextField
          id={"ownerNamePosX"}
          error={errors.ownerNamePosX}
          label={"Position (X)"}
          {...register("ownerNamePosX", { required: t("required-field") })}
        />
        <TextField
          id={"ownerNamePosY"}
          error={errors.ownerNamePosY}
          label={"Position (Y)"}
          {...register("ownerNamePosY", { required: t("required-field") })}
        />
        <TextField
          id={"ownerNameFontSize"}
          error={errors.ownerNameFontSize}
          label={"Font size"}
          {...register("ownerNameFontSize", { required: t("required-field") })}
        />
        <TextField
          id={"ownerNameTextColor"}
          error={errors.ownerNameTextColor}
          label={"Text color"}
          {...register("ownerNameTextColor", { required: t("required-field") })}
        />
        <SelectField
          id={"ownerNameTextAnchor"}
          options={anchorOptions}
          label="Text anchor"
          {...register("ownerNameTextAnchor")}
        />
      </div>
      <hr />
      <div>
        <h3>{t("certificate-validation-url")}</h3>
        <TextField
          id={"validateUrlPosX"}
          error={errors.validateUrlPosX}
          label={"Position (X)"}
          {...register("validateUrlPosX", { required: t("required-field") })}
        />
        <TextField
          id={"validateUrlPosY"}
          error={errors.validateUrlPosY}
          label={"Position (Y)"}
          {...register("validateUrlPosY", { required: t("required-field") })}
        />
        <TextField
          id={"validateUrlFontSize"}
          error={errors.validateUrlFontSize}
          label={"Font size"}
          {...register("validateUrlFontSize", { required: t("required-field") })}
        />
        <TextField
          id={"validateUrlTextColor"}
          error={errors.validateUrlTextColor}
          label={"Text color"}
          {...register("validateUrlTextColor", { required: t("required-field") })}
        />
        <SelectField
          id={"validateUrlTextAnchor"}
          options={anchorOptions}
          label="Text anchor"
          {...register("validateUrlTextAnchor")}
        />
      </div>
      <hr />
      <div>
        <h3>{t("date")}</h3>
        <TextField
          id={"datePosX"}
          error={errors.datePosX}
          label={"Position (X)"}
          {...register("datePosX", { required: t("required-field") })}
        />
        <TextField
          id={"datePosY"}
          error={errors.datePosY}
          label={"Position (Y)"}
          {...register("datePosY", { required: t("required-field") })}
        />
        <TextField
          id={"dateFontSize"}
          error={errors.dateFontSize}
          label={"Font size"}
          {...register("dateFontSize", { required: t("required-field") })}
        />
        <TextField
          id={"dateTextColor"}
          error={errors.dateTextColor}
          label={"Text color"}
          {...register("dateTextColor", { required: t("required-field") })}
        />
        <SelectField
          id={"dateTextAnchor"}
          options={anchorOptions}
          label="Text anchor"
          {...register("dateTextAnchor")}
        />
      </div>

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

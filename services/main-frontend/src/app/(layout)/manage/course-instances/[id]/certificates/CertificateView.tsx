"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { subheadingCss } from "@/components/credit-registration/styles"
import type { CertificateConfigurationAndRequirements } from "@/generated/api/types.generated"
import MaskOverThisInSystemTests from "@/shared-module/common/components/system-tests/MaskOverThisInSystemTests"
import SetHeightInSystemTests from "@/shared-module/common/components/system-tests/SetHeightInSystemTests"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, Link } from "@/shared-module/components"

interface Props {
  configurationAndRequirements: CertificateConfigurationAndRequirements
  onClickEdit: () => void
  onClickDelete: () => void
}

const CertificateView: React.FC<Props> = ({
  configurationAndRequirements,
  onClickEdit,
  onClickDelete,
}) => {
  const { t } = useTranslation()
  const configuration = configurationAndRequirements.certificate_configuration
  return (
    <div
      className={css`
        display: grid;
        gap: var(--space-2);
        width: 100%;

        hr {
          width: 100%;
          margin: var(--space-2) 0;
          border: none;
          border-top: 1px solid ${baseTheme.colors.clear[300]};
        }

        h3 {
          margin: 0 0 var(--space-2);
        }
      `}
    >
      <div>
        {t("locale")}: {configuration.certificate_locale}
      </div>
      <div>
        {t("paper-size")}: {configuration.paper_size}
      </div>
      <div>
        {t("background-svg")}:{" "}
        <MaskOverThisInSystemTests>
          <SetHeightInSystemTests heightPx={100}>
            <Link href={`/api/v0/files/${configuration.background_svg_path}`}>
              {configuration.background_svg_path}
            </Link>
          </SetHeightInSystemTests>
        </MaskOverThisInSystemTests>
      </div>
      <div>
        {t("overlay-svg")}:{" "}
        {configuration.overlay_svg_path ? (
          <MaskOverThisInSystemTests>
            <SetHeightInSystemTests heightPx={100}>
              <Link href={`/api/v0/files/${configuration.overlay_svg_path}`}>
                {configuration.overlay_svg_path}
              </Link>
            </SetHeightInSystemTests>
          </MaskOverThisInSystemTests>
        ) : (
          t("label-null")
        )}
      </div>
      <hr />
      <div>
        <h3 className={subheadingCss}>{t("certificate-owner-name")}</h3>
        <div>
          {t("position-x")}: {configuration.certificate_owner_name_x_pos}
        </div>
        <div>
          {t("position-y")}: {configuration.certificate_owner_name_y_pos}
        </div>
        <div>
          {t("font-size")}: {configuration.certificate_owner_name_font_size}
        </div>
        <div>
          {t("text-color")}: {configuration.certificate_owner_name_text_color}
        </div>
        <div>
          {t("text-anchor")}: {configuration.certificate_owner_name_text_anchor}
        </div>
      </div>
      <hr />
      <div>
        <h3 className={subheadingCss}>{t("certificate-validation-url")}</h3>
        <div>
          {t("position-x")}: {configuration.certificate_validate_url_x_pos}
        </div>
        <div>
          {t("position-y")}: {configuration.certificate_validate_url_y_pos}
        </div>
        <div>
          {t("font-size")}: {configuration.certificate_validate_url_font_size}
        </div>
        <div>
          {t("text-color")}: {configuration.certificate_validate_url_text_color}
        </div>
        <div>
          {t("text-anchor")}: {configuration.certificate_validate_url_text_anchor}
        </div>
      </div>
      <hr />
      <div>
        <h3 className={subheadingCss}>{t("date")}</h3>
        <div>
          {t("position-x")}: {configuration.certificate_date_x_pos}
        </div>
        <div>
          {t("position-y")}: {configuration.certificate_date_y_pos}
        </div>
        <div>
          {t("font-size")}: {configuration.certificate_date_font_size}
        </div>
        <div>
          {t("text-color")}: {configuration.certificate_date_text_color}
        </div>
        <div>
          {t("text-anchor")}: {configuration.certificate_date_text_anchor}
        </div>
      </div>
      <hr />
      <div>
        <h3 className={subheadingCss}>{t("label-grade")}</h3>
        <div>
          {t("label-show-grade-in-cerfiticate")}:{" "}
          {configuration.render_certificate_grade ? t("yes") : t("no")}
        </div>
        <div>
          {t("position-x")}: {configuration.certificate_grade_x_pos}
        </div>
        <div>
          {t("position-y")}: {configuration.certificate_grade_y_pos}
        </div>
        <div>
          {t("font-size")}: {configuration.certificate_grade_font_size}
        </div>
        <div>
          {t("text-color")}: {configuration.certificate_grade_text_color}
        </div>
        <div>
          {t("text-anchor")}: {configuration.certificate_grade_text_anchor}
        </div>
      </div>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
          margin-top: var(--space-3);
        `}
      >
        <Button variant="secondary" size="medium" onClick={onClickEdit}>
          {t("edit")}
        </Button>
        <Button variant="secondary" size="medium" onClick={onClickDelete}>
          {t("delete")}
        </Button>
        <div
          className={css`
            flex-grow: 1;
          `}
        />
        <Link
          href={`/certificates/validate/test?test_certificate_configuration_id=${configurationAndRequirements.certificate_configuration.id}&debug=true`}
          styledAsButton
          variant="secondary"
          size="medium"
        >
          {t("button-text-preview")}
        </Link>
      </div>
    </div>
  )
}

export default CertificateView

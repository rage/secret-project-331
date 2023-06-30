import { css } from "@emotion/css"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import { CourseModuleCertificateConfiguration } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import { baseTheme } from "../../../../shared-module/styles"

interface Props {
  configuration: CourseModuleCertificateConfiguration
  onClickEdit: () => void
  onClickDelete: () => void
}

const CertificateView: React.FC<Props> = ({ configuration, onClickEdit, onClickDelete }) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        hr {
          color: ${baseTheme.colors.clear[300]};
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
        <Link href={`/api/v0/files/${configuration.background_svg_path}`}>
          {configuration.background_svg_path}
        </Link>
      </div>
      <div>
        {t("overlay-svg")}:{" "}
        {(
          <Link href={`/api/v0/files/${configuration.background_svg_path}`}>
            {configuration.overlay_svg_path}
          </Link>
        ) ?? "None"}
      </div>
      <hr />
      <div>
        <h3>{t("certificate-owner-name")}</h3>
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
        <h3>{t("certificate-validation-url")}</h3>
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
        <h3>{t("date")}</h3>
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
      <div
        className={css`
          display: flex;
          margin-top: 1rem;
        `}
      >
        <Button variant="primary" size="medium" onClick={onClickEdit}>
          {t("edit")}
        </Button>
        <Button variant="tertiary" size="medium" onClick={onClickDelete}>
          {t("delete")}
        </Button>
        <div
          className={css`
            flex-grow: 1;
          `}
        />
        <Link
          href={`/certificates/validate/test?test_course_instance_id=${configuration.course_instance_id}&test_course_module_id=${configuration.course_module_id}&debug=true`}
        >
          <Button variant="tertiary" size="medium">
            {t("button-text-preview")}
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default CertificateView

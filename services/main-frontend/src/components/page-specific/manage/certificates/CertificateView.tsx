import { useTranslation } from "react-i18next"

import { CourseModuleCertificateConfiguration } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"

interface Props {
  configuration: CourseModuleCertificateConfiguration
  onClickEdit: () => void
  onClickDelete: () => void
}

const CertificateView: React.FC<Props> = ({ configuration, onClickEdit, onClickDelete }) => {
  const { t } = useTranslation()
  return (
    <div>
      <div>
        {t("certificate-owner-name")}
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
        {t("certificate-validation-url")}
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
        {t("date")}
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
      <div>
        {t("locale")}: {configuration.certificate_locale}
      </div>
      <div>
        {t("paper-size")}: {configuration.certificate_locale}
      </div>
      <div>
        {t("background-svg")}: {configuration.background_svg_path}
      </div>
      <div>
        {t("overlay-svg")}: {configuration.overlay_svg_path ?? "None"}
      </div>
      <Button variant="primary" size="medium" onClick={onClickEdit}>
        {t("edit")}
      </Button>
      <Button variant="tertiary" size="medium" onClick={onClickDelete}>
        {t("delete")}
      </Button>
    </div>
  )
}

export default CertificateView

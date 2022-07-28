import { useTranslation } from "react-i18next"

const Unsupported: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  return (
    <div>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
    </div>
  )
}

export default Unsupported

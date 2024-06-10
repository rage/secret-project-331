import { useTranslation } from "react-i18next"

const BooleanAsText = ({ value }: { value: boolean }) => {
  const { t } = useTranslation()
  return <>{value ? t("label-true") : t("label-false")}</>
}

export default BooleanAsText

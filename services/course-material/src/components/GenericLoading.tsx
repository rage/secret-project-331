import { css } from "@emotion/css"
import { Fade } from "@material-ui/core"
import React from "react"
import { useTranslation } from "react-i18next"

const GenericLoading: React.FC = () => {
  const { t } = useTranslation()
  return (
    <Fade
      in={true}
      // @ts-ignore: normal css property, should work
      className={css`
        transition-delay: 800ms;
      `}
      unmountOnExit
    >
      <p>{t("loading")}</p>
    </Fade>
  )
}

export default GenericLoading

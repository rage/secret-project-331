import { css } from "@emotion/css"
import { faAngleDown, faAngleUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../shared-module/styles"
import { runCallbackIfEnterPressed } from "../shared-module/utils/accessibility"

export interface CollapsibleProps {
  title: string
}

const Collapsible: React.FC<React.PropsWithChildren<CollapsibleProps>> = ({ children, title }) => {
  const [visible, setVisible] = useState(false)
  const { t } = useTranslation()

  return (
    <div
      className={css`
        background: ${baseTheme.colors.clear[200]};
      `}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setVisible(!visible)}
        onKeyDown={(e) => runCallbackIfEnterPressed(e, () => setVisible(!visible))}
        aria-label={visible ? t("show") : t("hide")}
        className={css`
          align-items: stretch;
          background: ${baseTheme.colors.gray[100]};
          border: 1px solid ${baseTheme.colors.gray[200]};
          display: flex;
          flex-direction: row;
          padding: 0.5rem 0 0.5rem 2rem;

          :hover {
            filter: brightness(92%) contrast(110%);
            cursor: pointer;
          }
        `}
      >
        <div
          className={css`
            align-items: center;
            display: flex;
            flex: 1;
          `}
        >
          {title}
        </div>
        <div
          className={css`
            align-items: center;
            display: flex;
            flex: 0 0 3rem;
            height: 3rem;
            justify-content: center;
          `}
        >
          <FontAwesomeIcon icon={visible ? faAngleUp : faAngleDown} />
        </div>
      </div>
      {visible && (
        <div
          className={css`
            padding: 1rem 0;
          `}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export default Collapsible

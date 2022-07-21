import { css } from "@emotion/css"
import React from "react"

import { baseTheme } from "../../styles"

export interface LanguageMenuProps {
  visible: boolean
}

const LanguageMenu: React.FC<LanguageMenuProps> = ({ children, visible }) => {
  return visible ? (
    <div
      className={css`
        background: ${baseTheme.colors.clear[200]};
      `}
    >
      {children}
    </div>
  ) : null
}

export default LanguageMenu

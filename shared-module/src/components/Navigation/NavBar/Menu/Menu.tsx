import { css, cx } from "@emotion/css"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../../../styles"
import { runCallbackIfEnterPressed } from "../../../../utils/accessibility"

import Hamburger from "./Hamburger/Hamburger"

const NavMenu = css`
  padding: 0px;
  & > * {
    margin-left: 20px;
  }
`

// eslint-disable-next-line i18next/no-literal-string
const MenuIcon = css`
  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
  }
`

// eslint-disable-next-line i18next/no-literal-string
const ToolTip = css`
  background: #fff;
  border-color: #cacaca;
  top: 70px;
  right: 17px;
  padding: 0;
  border-radius: 4px;
  position: absolute;
  margin-bottom: 10px;
  margin-left: -95px;
  z-index: 901;
  box-shadow: 0px 0px 5px rgba(51, 51, 51, 0.1);

  li {
    text-decoration: none;
    padding: 12px 34px;
    border-bottom: 2px solid #e1e1e1;
    list-style: none;
    margin: 0;

    &:last-child {
      border-bottom: none;
    }

    Button {
      text-decoration: none;
      list-style: none;
      border: none;
      margin: 0;
      padding: 0;
      font-size: 16px;
      background: inherit;
      text-transform: none;
      color: ${baseTheme.colors.green[500]};
    }

    Button:hover {
      background: inherit;
      color: ${baseTheme.colors.green[700]};
    }
  }
`

const Hide = css`
  display: none;
`

const Menu: React.FC = ({ children }) => {
  const [clicked, setClicked] = useState(false)
  const { t } = useTranslation()

  const onClickHandler = () => {
    setClicked(!clicked)
  }
  return (
    <div className={cx(NavMenu)}>
      <div
        className={cx(MenuIcon)}
        onClick={onClickHandler}
        onKeyDown={(e) => runCallbackIfEnterPressed(e, onClickHandler)}
        role="button"
        aria-label={t("open-menu")}
        tabIndex={0}
      >
        <Hamburger isActive={clicked} toggleButton={onClickHandler} />
      </div>
      <ul className={clicked ? cx(ToolTip) : cx(Hide)}>{children}</ul>
    </div>
  )
}

export default Menu

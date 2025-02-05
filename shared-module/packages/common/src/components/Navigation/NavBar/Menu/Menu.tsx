import { css, cx } from "@emotion/css"
import { ReactNode, useState } from "react"
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

const MenuIcon = css`
  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
  }
`

const ToolTip = css`
  background: #fff;
  border-color: #cacaca;
  padding: 0;
  border-radius: 4px;
  position: absolute;
  margin-bottom: 10px;
  margin-left: -95px;
  z-index: 901;
  box-shadow: 0px 0px 5px rgba(51, 51, 51, 0.1);

  li {
    text-decoration: none;

    border-bottom: 2px solid #e1e1e1;
    list-style: none;
    margin: 0;
    background-color: white;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      filter: brightness(92%) contrast(110%);
    }

    Button {
      text-decoration: none;
      list-style: none;
      border: none;
      margin: 0;
      padding: 12px 25px;
      font-size: 16px;
      background: inherit;
      text-transform: none;
      text-align: center;
      width: 100%;
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

export interface MenuProps {
  variant?: "top" | "bottom"
  children: ReactNode
}

const Menu: React.FC<React.PropsWithChildren<React.PropsWithChildren<MenuProps>>> = ({
  children,
  variant,
}) => {
  const [clicked, setClicked] = useState(false)
  const { t } = useTranslation()

  const buttonId = variant === "bottom" ? "" : "main-navigation-menu"
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
        <Hamburger isActive={clicked} toggleButton={onClickHandler} buttonId={buttonId} />
      </div>
      <ul
        className={
          clicked
            ? cx(
                ToolTip,
                css`
                  ${variant === "bottom" ? "bottom: 70px;" : "top: 70px;right:17px;"}
                `,
              )
            : cx(Hide)
        }
      >
        {children}
      </ul>
    </div>
  )
}

export default Menu
dren}
      </ul>
    </div>
  )
}

export default Menu

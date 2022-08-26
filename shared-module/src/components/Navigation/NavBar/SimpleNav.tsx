import { css, cx } from "@emotion/css"
import { faFingerprint } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../../styles"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "../../../utils/constants"

import { NavigationProps } from "."

const StyledIcon = css`
  font-size: 1.8rem;
  color: ${baseTheme.colors.grey[700]};
`
// eslint-disable-next-line i18next/no-literal-string
const Navbar = css`
  background: #f9f9f9;
  height: 90px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  font-size: 1rem;
  padding: 0 4rem;
  margin-bottom: ${MARGIN_BETWEEN_NAVBAR_AND_CONTENT};
  border-bottom: 2px solid ${baseTheme.colors.grey[100]};

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
  }
`
// eslint-disable-next-line i18next/no-literal-string
const NavbarLogo = css`
  color: ${baseTheme.colors.grey[700]};
  cursor: pointer;

  & > a:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
  }
`

const Navigation: React.FC<React.PropsWithChildren<React.PropsWithChildren<NavigationProps>>> = ({
  children,
}) => {
  const { t } = useTranslation()

  return (
    <nav role="navigation" className={cx(Navbar)} aria-label={t("navigation-menu")}>
      <div className={cx(NavbarLogo)}>
        <a href="/" aria-label="Home page" role="button">
          <FontAwesomeIcon
            className={cx(StyledIcon)}
            icon={faFingerprint}
            aria-label={t("home-page")}
            aria-hidden="true"
          />
        </a>
      </div>
      {children}
    </nav>
  )
}

export default Navigation

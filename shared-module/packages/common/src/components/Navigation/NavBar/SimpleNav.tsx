import { css, cx } from "@emotion/css"
import { useTranslation } from "react-i18next"

import MOOCfi from "../../../img/moocfiLogoNoText.svg"
import { baseTheme } from "../../../styles"
import { respondToOrLarger } from "../../../styles/respond"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "../../../utils/constants"
import SkipLink from "../../SkipLink"

import { NavigationProps } from "."

const StyledIcon = css`
  font-size: 1.8rem;
  transform: scale(0.7);

  path {
    fill: ${baseTheme.colors.gray[600]} !important;
  }
`
const Navbar = css`
  height: 90px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  font-size: 1rem;
  padding: 0 1.4rem;
  margin-bottom: ${MARGIN_BETWEEN_NAVBAR_AND_CONTENT};
  border-bottom: 2px solid ${baseTheme.colors.gray[100]};

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
  }

  ${respondToOrLarger.md} {
    padding: 0 4rem;
  }
`
const NavbarLogo = css`
  cursor: pointer;
  color: ${baseTheme.colors.gray[700]};

  & > a:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
  }
`

const Navigation: React.FC<React.PropsWithChildren<React.PropsWithChildren<NavigationProps>>> = ({
  children,
}) => {
  const { t, i18n } = useTranslation()

  const makeTopLeftButtonToTemporarilyGoToMoocfi = true

  const moocfiUrl =
    i18n?.language?.indexOf("fi") !== -1 ? "https://www.mooc.fi" : "https://www.mooc.fi/en"

  return (
    <nav role="navigation" className={cx(Navbar)} aria-label={t("navigation-menu")}>
      <SkipLink href="#maincontent">{t("skip-to-content")}</SkipLink>
      <div className={cx(NavbarLogo)}>
        <a
          href={makeTopLeftButtonToTemporarilyGoToMoocfi ? moocfiUrl : "/"}
          aria-label={t("home-page")}
          role="button"
        >
          <MOOCfi className={cx(StyledIcon)} />
        </a>
      </div>
      {children}
    </nav>
  )
}

export default Navigation

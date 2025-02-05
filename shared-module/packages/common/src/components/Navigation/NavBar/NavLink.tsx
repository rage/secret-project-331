import { css, cx } from "@emotion/css"

import { baseTheme } from "../../../styles"

const NavLinkStyles = css`
  color: ${baseTheme.colors.gray[700]};
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  position: relative;
  font-size: 1.2rem;
  line-height: 1.5rem;
  /* margin: 0.5rem 1.5rem; */
  outline: none;
  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
  }
  /*
  &:after {
    content: "";
    position: absolute;
    width: 100%;
    transform: scaleX(0);
    height: 2px;
    bottom: 0;
    left: 0;
    background-color: ${baseTheme.colors.gray[700]};
    transform-origin: bottom right;
    transition: transform 0.4s cubic-bezier(0.86, 0, 0.07, 1);
  }
  &:hover::after {
    transform: scaleX(1);
    transform-origin: bottom le;
  }
  */
  &:hover {
    transform: scaleX(1);
    transform-origin: bottom left;
  }
`

interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  className?: string
}

const NavLink: React.FC<React.PropsWithChildren<React.PropsWithChildren<NavLinkProps>>> = ({
  children,
  className,
  ...rest
}) => {
  return (
    <li className={cx(className)}>
      <a className={cx(NavLinkStyles)} {...rest}>
        {children}
      </a>
    </li>
  )
}

export default NavLink

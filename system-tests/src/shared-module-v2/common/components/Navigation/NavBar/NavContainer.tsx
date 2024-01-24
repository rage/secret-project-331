import { css } from "@emotion/css"

const NavContainer: React.FC<React.PropsWithChildren<React.PropsWithChildren<unknown>>> = ({
  children,
}) => {
  return (
    <div
      className={css`
        flex-grow: 1;
        align-items: center;
      `}
    >
      {children}
    </div>
  )
}

export default NavContainer

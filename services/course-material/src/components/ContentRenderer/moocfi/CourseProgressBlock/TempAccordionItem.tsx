import { css } from "@emotion/css"
import { animated, useSpring } from "react-spring"

import ArrowDown from "@/shared-module/common/img/caret-arrow-down.svg"
import ArrowUp from "@/shared-module/common/img/caret-arrow-up.svg"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { runCallbackIfEnterPressed } from "@/shared-module/common/utils/accessibility"

// This should be replaced once the issues with the shared module one are resolved.
// (it seems to only render child components)
const TempAccordion: React.FC<
  React.PropsWithChildren<{ title: string; open: boolean; onClick: () => void }>
> = ({ title, open, onClick, children }) => {
  const openAnimation = useSpring({
    to: { opacity: open ? 1 : 0 },
    from: { opacity: open ? 0 : 1 },
    duration: 2000,
  })

  return (
    <div>
      <div
        onClick={onClick}
        onKeyDown={(e) => runCallbackIfEnterPressed(e, onClick)}
        role="button"
        tabIndex={0}
        className={css`
          background-color: rgb(242, 245, 247);
          font-family: ${headingFont};
          margin-bottom: ${open ? "3px" : "6px"};
          cursor: pointer;
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          padding: 1rem 2rem;

          &:hover {
            background: rgb(235, 239, 242);
          }
        `}
      >
        <div
          className={css`
            flex: 1;
            font-weight: 500;
            color: ${baseTheme.colors.gray[700]};
            opacity: 0.9;
          `}
        >
          {title}
        </div>
        {open ? (
          <ArrowUp
            className={css`
              margin-top: 8px;
              transform: scale(1.6);
            `}
          />
        ) : (
          <ArrowDown
            className={css`
              margin-top: 8px;
              transform: scale(1.6);
            `}
          />
        )}
      </div>
      {open ? <animated.div style={openAnimation}>{children}</animated.div> : null}
    </div>
  )
}

export default TempAccordion

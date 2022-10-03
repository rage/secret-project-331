import { css } from "@emotion/css"
import { faAngleDown, faAngleUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { animated, useSpring } from "react-spring"

import { baseTheme, headingFont } from "../../../../shared-module/styles"
import { runCallbackIfEnterPressed } from "../../../../shared-module/utils/accessibility"

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

  const faIcon = open ? faAngleUp : faAngleDown
  return (
    <div>
      <div
        onClick={onClick}
        onKeyDown={(e) => runCallbackIfEnterPressed(e, onClick)}
        role="button"
        tabIndex={0}
        className={css`
          background-color: ${baseTheme.colors.clear[100]};
          font-family: ${headingFont};
          margin-bottom: ${open ? "3px" : "6px"};
          cursor: pointer;
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          padding: 1rem 2rem;

          &:hover {
            background: ${baseTheme.colors.clear[200]};
          }
        `}
      >
        <div
          className={css`
            flex: 1;
          `}
        >
          {title}
        </div>
        <div
          className={css`
            flex: 0 0 auto;
          `}
        >
          <FontAwesomeIcon icon={faIcon} />
        </div>
      </div>
      {open ? <animated.div style={openAnimation}>{children}</animated.div> : null}
    </div>
  )
}

export default TempAccordion

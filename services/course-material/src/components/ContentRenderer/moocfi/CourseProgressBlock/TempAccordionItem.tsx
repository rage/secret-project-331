import { css } from "@emotion/css"
import { faAngleDown, faAngleUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import { runCallbackIfEnterPressed } from "../../../../shared-module/utils/accessibility"

// This should be replaced once the issues with the shared module one are resolved.
// (it seems to only render child components)
const TempAccordion: React.FC<{ title: string; open: boolean; onClick: () => void }> = ({
  title,
  open,
  onClick,
  children,
}) => {
  const faIcon = open ? faAngleUp : faAngleDown
  return (
    <div>
      <div
        onClick={onClick}
        onKeyDown={(e) => runCallbackIfEnterPressed(e, onClick)}
        role="button"
        tabIndex={0}
        className={css`
          background-color: #f5f6f7;
          cursor: pointer;
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          padding: 1rem 2rem;
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
      {open ? <div>{children}</div> : null}
    </div>
  )
}

export default TempAccordion

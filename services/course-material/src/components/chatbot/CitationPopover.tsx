import { css } from "@emotion/css"
import { Library } from "@vectopus/atlas-icons-react"
import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

type CitationType = Pick<
  ChatbotConversationMessageCitation,
  "citation_number" | "course_material_chapter_number" | "title" | "document_url"
>

interface CitationPopoverProps {
  id: string
  linkId: string
  setPopperElement: React.Dispatch<React.SetStateAction<HTMLElement | null>>
  setHoverPopperElement: (value: React.SetStateAction<boolean>) => void
  setArrowElement: React.Dispatch<React.SetStateAction<HTMLElement | null>>
  escape: () => void
  citation: CitationType
  content: string
  popperStyles: {
    [key: string]: React.CSSProperties
  }
  popperAttributes: {
    [key: string]:
      | {
          [key: string]: string
        }
      | undefined
  }
}

// modified from SpeechBalloon
const BORDER_RADIUS = "8px"
const BORDER_WIDTH = "2px"
const POINTER_SIZE = "12px"

const COLORS = {
  bg: "#ffffff",
  border: baseTheme.colors.green[400],
  text: baseTheme.colors.gray[700],
  shadow: "rgba(0, 0, 0, 0.4)",
}

const speechBalloonStyle = css`
  display: flex;
  width: 66vw;
  ${respondToOrLarger.sm} {
    width: 330px;
  }
  flex-flow: column nowrap;
  position: relative;
  background: ${COLORS.bg};
  color: ${COLORS.text};
  padding: 1rem 1.5rem;
  border-radius: ${BORDER_RADIUS};
  border: ${BORDER_WIDTH} solid ${COLORS.border};
  box-shadow: 0 3px 15px 0px ${COLORS.shadow};
  margin-bottom: ${POINTER_SIZE};
  transition: filter 0.3s;

  &:active {
    transform: translateY(0);
  }
`
const arrowStyle = css`
  &:after {
    content: "";
    position: absolute;
    bottom: ${BORDER_WIDTH};
    left: calc(50% - ${POINTER_SIZE});
    width: 0;
    height: 0;
    border-left: ${POINTER_SIZE} solid transparent;
    border-right: ${POINTER_SIZE} solid transparent;
    border-top: ${POINTER_SIZE} solid ${COLORS.border};
    filter: drop-shadow(0 8px 6px ${COLORS.shadow});
  }

  &:before {
    content: "";
    position: absolute;
    bottom: calc(${BORDER_WIDTH} + ${BORDER_WIDTH} * 1.5);
    left: calc(50% - ${POINTER_SIZE} + ${BORDER_WIDTH});
    width: 0;
    height: 0;
    border-left: calc(${POINTER_SIZE} - ${BORDER_WIDTH}) solid transparent;
    border-right: calc(${POINTER_SIZE} - ${BORDER_WIDTH}) solid transparent;
    border-top: calc(${POINTER_SIZE} - ${BORDER_WIDTH} * 1.5) solid ${COLORS.bg};
    z-index: 1;
  }
`

const popoverStyle = (content: string) => css`
  z-index: 100;
  animation: fadeIn 0.2s ease-in-out;
  pointer-events: auto;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  #${content} {
    overflow-wrap: break-word;
    height: 5lh;
    margin-bottom: 0.5em;
    mask-image: linear-gradient(0.5turn, black 66%, transparent);
  }
  a {
    &:hover {
      span {
        color: ${baseTheme.colors.blue[700]};
        text-decoration: underline;
      }
    }
  }
`

const CitationPopover: React.FC<CitationPopoverProps> = ({
  id,
  linkId,
  setPopperElement,
  setHoverPopperElement,
  setArrowElement,
  escape,
  citation,
  content,
  popperStyles,
  popperAttributes,
}) => {
  const { t } = useTranslation()

  const popLabelId = useId()
  const popDescribeId = useId()

  return (
    <div
      id={id}
      role="dialog"
      aria-labelledby={popLabelId}
      aria-describedby={popDescribeId}
      ref={setPopperElement}
      className={popoverStyle(popDescribeId)}
      /* eslint-disable-next-line react/forbid-dom-props */
      style={popperStyles.popper}
      onMouseEnter={() => {
        setHoverPopperElement(true)
      }}
      onMouseLeave={() => {
        setHoverPopperElement(false)
      }}
      onBlur={() => {
        //unfocusPopperElement()
      }}
      {...popperAttributes.popper}
    >
      <div className={speechBalloonStyle}>
        <p id={popDescribeId} dangerouslySetInnerHTML={{ __html: content }}></p>
        <p
          id={popLabelId}
          className={css`
            display: flex;
            justify-content: space-between;
            flex-flow: row nowrap;
            position: relative;

            a::after {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
            }
          `}
        >
          <a
            href={citation.document_url}
            id={linkId}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                escape()
              }
            }}
          >
            <span>
              <b>
                {t("chapter-chapter-number", {
                  chapterNumber: citation.course_material_chapter_number,
                })}{" "}
                {citation.title}
              </b>
            </span>
          </a>
          <Library size={18} />
        </p>
      </div>
      <div
        ref={setArrowElement}
        /* eslint-disable-next-line react/forbid-dom-props */
        style={popperStyles.arrow}
        className={arrowStyle}
        {...popperAttributes.arrow}
      />
    </div>
  )
}

export default React.memo(CitationPopover)

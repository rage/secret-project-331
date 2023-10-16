import { css } from "@emotion/css"
import ClickAwayListener from "@mui/base/ClickAwayListener"
import { useEffect, useRef } from "react"

import { typography } from "../styles"

interface DialogExtraProps {
  open: boolean
  onClose?: () => void
  closeable?: boolean
  noPadding?: boolean
  width?: "normal" | "wide"
}

const Dialog: React.FC<React.HTMLAttributes<HTMLDialogElement> & DialogExtraProps> = ({
  children,
  open,
  onClose,
  closeable = true,
  noPadding = false,
  width = "normal",
  ...rest
}) => {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const current = ref.current
    const closeCallback = () => {
      if (onClose) {
        onClose()
      }
    }
    current?.addEventListener("close", closeCallback)
    return () => {
      current?.removeEventListener("close", closeCallback)
    }
  }, [onClose])

  useEffect(() => {
    if (!ref.current) {
      return
    }
    if (open && !ref.current.open) {
      ref.current.showModal()
    } else if (ref.current.open) {
      ref.current.close()
    }
  }, [open])

  // Make non-closable dialogs not closable
  useEffect(() => {
    if (!ref.current || closeable) {
      return
    }
    const eventHandler = (event: Event) => {
      if (!event.cancelable) {
        ref.current?.showModal()
      }
      event.preventDefault()
    }
    const element = ref.current
    element.addEventListener("close", eventHandler)
    element.addEventListener("cancel", eventHandler)
    return () => {
      element?.removeEventListener("close", eventHandler)
      element?.removeEventListener("cancel", eventHandler)
    }
  }, [closeable])

  return (
    <dialog
      ref={ref}
      {...rest}
      className={css`
        border: 0;
        border-radius: 5px;
        padding: 0;
        width: 95%;
        max-width: ${width === "normal" ? "700px" : "1200px"};

        h1 {
          font-size: ${typography.h5};
        }
        h2 {
          font-size: ${typography.h6};
        }
        h3 {
          font-size: ${typography.h6};
        }
        h4 {
          font-size: ${typography.h6};
        }
        h5 {
          font-size: ${typography.h6};
        }
        h6 {
          font-size: ${typography.h6};
        }

        &::backdrop {
          background: rgba(0, 0, 0, 0.4);
        }
      `}
    >
      {open && (
        <ClickAwayListener
          onClickAway={() => {
            if (closeable) {
              ref.current?.close()
            }
          }}
        >
          {/* For accessibility, so that screen readers don't interpret the whole dialog as clickable. */}
          <div
            role="presentation"
            className={css`
              ${!noPadding && `padding: 2rem 3rem;`}
            `}
          >
            {children}
          </div>
        </ClickAwayListener>
      )}
    </dialog>
  )
}

export default Dialog

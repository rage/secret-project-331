import { css } from "@emotion/css"
import ClickAwayListener from "@mui/base/ClickAwayListener"
import { useEffect, useRef } from "react"

import { typography } from "../styles"

interface DialogExtraProps {
  open: boolean
  onClose: () => void
}

const Dialog: React.FC<React.HTMLAttributes<HTMLDialogElement> & DialogExtraProps> = ({
  children,
  open,
  onClose,
  ...rest
}) => {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const current = ref.current
    const closeCallback = () => {
      onClose()
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

  return (
    <dialog
      ref={ref}
      {...rest}
      className={css`
        border: 0;
        border-radius: 5px;
        padding: 0;
        width: 95%;
        max-width: 700px;

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
            ref.current?.close()
          }}
        >
          {/* For accessibility, so that screen readers don't interpret the whole dialog as clickable. */}
          <div
            role="presentation"
            className={css`
              padding: 2rem 3rem;
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

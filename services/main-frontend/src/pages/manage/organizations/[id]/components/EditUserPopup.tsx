import { css } from "@emotion/css"
import React from "react"

import { primaryButton } from "../styles/sharedStyles"

interface EditUserPopupProps {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  name: string
  email: string
  role: string
  setRole: React.Dispatch<React.SetStateAction<string>>
  handleSave: () => void
}

const EditUserPopup: React.FC<EditUserPopupProps> = ({
  show,
  setShow,
  name,
  email,
  role,
  setRole,
  handleSave,
}) => {
  const containerStyles = css({
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "90%",
    maxWidth: "843px",
    background: "#ffffff",
    boxShadow: "0px 8px 40px rgba(0, 0, 0, 0.1)",
    borderRadius: "3px",
    padding: "32px",
    zIndex: 9999,
    fontFamily: "Inter, sans-serif",
    color: "#1a2333",
    opacity: show ? 1 : 0,
    pointerEvents: show ? "auto" : "none",
    transition: "opacity 0.3s ease",
  })

  return (
    <div className={containerStyles}>
      <button
        onClick={() => setShow(false)}
        className={css`
          position: absolute;
          top: 16px;
          right: 16px;
          width: 26px;
          height: 20px;
          background: transparent;
          border: none;
          font-size: 20px;
          font-weight: bold;
          color: #1a2333;
          cursor: pointer;
          line-height: 20px;
          text-align: center;
          padding: 0;
        `}
      >
        x
      </button>

      <h2
        className={css`
          font-size: 18px;
        `}
      >
        Edit User Role
      </h2>

      <div
        className={css`
          width: 100%;
          border-top: 1px solid #ced1d7;
          margin: 16px 0;
        `}
      />

      <p
        className={css`
          font-size: 16px;
          margin-bottom: 32px;
        `}
      >
        You can change the role of this user. Email and name are shown for reference.
      </p>

      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 32px;
        `}
      >
        {/* Name Row */}
        <div
          className={css`
            display: flex;
            align-items: center;
            margin-bottom: 12px;
            gap: 12px;
          `}
        >
          <label
            className={css`
              font-size: 14px;
              width: 60px;
            `}
          >
            Name
          </label>
          <span
            className={css`
              font-size: 14px;
              word-break: break-word;
            `}
          >
            {name}
          </span>
        </div>

        {/* Email Row */}
        <div
          className={css`
            display: flex;
            align-items: center;
            margin-bottom: 12px;
            gap: 12px;
          `}
        >
          <label
            className={css`
              font-size: 14px;
              width: 60px;
            `}
          >
            Email
          </label>
          <span
            className={css`
              font-size: 14px;
              word-break: break-word;
            `}
          >
            {email}
          </span>
        </div>

        {/* Role */}
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 12px;
          `}
        >
          <label
            className={css`
              font-size: 14px;
              width: 60px;
            `}
          >
            Role
          </label>
          <input
            type="text"
            placeholder="Select role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
              flex: 1;
            `}
          />
        </div>
      </div>

      <div
        className={css`
          display: flex;
          justify-content: flex-start;
          gap: 12px;
        `}
      >
        <button onClick={handleSave} className={primaryButton}>
          Save
        </button>
        <button
          onClick={() => setShow(false)}
          className={css`
            background: #e5e7e9;
            color: #1a2333;
            padding: 8px 16px;
            border-radius: 2px;
            border: none;
          `}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default EditUserPopup

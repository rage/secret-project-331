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
    width: "843px",
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
        Change the role for <strong>{name}</strong> ({email}).
      </p>

      <div
        className={css`
          display: flex;
          gap: 24px;
          margin-bottom: 32px;
        `}
      >
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
          `}
        >
          <label>Name</label>
          <div
            className={css`
              padding: 8px 12px;
              font-size: 14px;
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              background: #f5f5f5;
            `}
          >
            {name}
          </div>
        </div>

        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
          `}
        >
          <label>Email</label>
          <div
            className={css`
              padding: 8px 12px;
              font-size: 14px;
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              background: #f5f5f5;
              word-break: break-all;
            `}
          >
            {email}
          </div>
        </div>
      </div>

      <div
        className={css`
          margin-bottom: 32px;
          display: flex;
          flex-direction: column;
        `}
      >
        <label>New Role</label>
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
          `}
        />
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

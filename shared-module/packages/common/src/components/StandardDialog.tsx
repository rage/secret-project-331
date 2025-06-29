import React from "react"
import StandardDialog from "@/shared-module/common/components/StandardDialog"
import { css } from "@emotion/css"

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
  return (
    <StandardDialog
      open={show}
      onClose={() => setShow(false)}
      title="Edit User Role"
      buttons={[
        {
          children: "Cancel",
          variant: "secondary",
          onClick: () => setShow(false),
        },
        {
          children: "Save",
          variant: "primary",
          onClick: handleSave,
        },
      ]}
    >
      <p
        className={css`
          font-size: 16px;
          margin-bottom: 32px;
        `}
      >
        You can change the role of this user. Email and name are shown for reference.
      </p>

      {/* Name */}
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
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

      {/* Email */}
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
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

      {/* Role input */}
      <div
        className={css`
          display: flex;
          flex-direction: column;
        `}
      >
        <label
          className={css`
            font-size: 14px;
            margin-bottom: 4px;
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
          `}
        />
      </div>
    </StandardDialog>
  )
}

export default EditUserPopup

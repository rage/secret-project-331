import { css } from "@emotion/css"
import React from "react"

import { primaryButton } from "../styles/sharedStyles"

import StandardDialog from "@/shared-module/common/components/StandardDialog"

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
          children: "Save",
          onClick: handleSave,
          variant: "primary",
        },
        {
          children: "Cancel",
          onClick: () => setShow(false),
          variant: "secondary",
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
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
              width: 100%;
              background-color: white;
            `}
          >
            <option value="">Select a role</option>
            <option value="Admin">Admin</option>
            <option value="Assistant">Assistant</option>
            <option value="Reviewer">Reviewer</option>
            <option value="Teacher">Teacher</option>
            <option value="CourseOrExamCreator">Course or Exam Creator</option>
            <option value="MaterialViewer">Material Viewer</option>
            <option value="TeachingAndLearningServices">Teaching & Learning Services</option>
            <option value="StatsViewer">Stats Viewer</option>
          </select>
        </div>
      </div>
    </StandardDialog>
  )
}

export default EditUserPopup

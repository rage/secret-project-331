import { css } from "@emotion/css"
import React from "react"

import StandardDialog from "@/shared-module/common/components/StandardDialog"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface AddUserPopupProps {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  email: string
  setEmail: React.Dispatch<React.SetStateAction<string>>
  role: string
  setRole: React.Dispatch<React.SetStateAction<string>>
  handleSave: () => void
}

const AddUserPopup: React.FC<AddUserPopupProps> = ({
  show,
  setShow,
  email,
  setEmail,
  role,
  setRole,
  handleSave,
}) => {
  return (
    <StandardDialog
      open={show}
      onClose={() => setShow(false)}
      title="Add User to Permission"
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
        Select an email address and a role (e.g., Teachers) to assign to this course.
      </p>

      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 32px;

          ${respondToOrLarger.lg} {
            flex-direction: row;
          }
        `}
      >
        {/* Email */}
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
          `}
        >
          <label>Email</label>
          <input
            type="text"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
            `}
          />
        </div>

        {/* Role */}
        <div
          className={css`
            flex: 1;
            display: flex;
            flex-direction: column;
          `}
        >
          <label>Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={css`
              border: 1.6px solid #e4e5e8;
              border-radius: 2px;
              padding: 8px 12px;
              font-size: 14px;
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

export default AddUserPopup

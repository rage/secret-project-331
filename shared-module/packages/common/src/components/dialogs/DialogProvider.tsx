import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react"

import dialogService from "../../services/dialogService"

import AlertDialog from "./AlertDialog"
import ConfirmDialog from "./ConfirmDialog"
import PromptDialog from "./PromptDialog"

type DialogBase = {
  id: number
  title: string
  message?: React.ReactNode
}

type AlertDialogType = DialogBase & {
  type: "alert"
  resolve: () => void
}

type ConfirmDialogType = DialogBase & {
  type: "confirm"
  resolve: (result: boolean) => void
}

type PromptDialogType = DialogBase & {
  type: "prompt"
  defaultValue?: string
  resolve: (result: string | null) => void
}

type DialogType = AlertDialogType | ConfirmDialogType | PromptDialogType

type DialogAction =
  | { type: "PUSH_DIALOG"; dialog: DialogType }
  | { type: "REMOVE_DIALOG"; id: number }

const dialogReducer = (state: DialogType[], action: DialogAction): DialogType[] => {
  switch (action.type) {
    case "PUSH_DIALOG":
      return [...state, action.dialog]
    case "REMOVE_DIALOG":
      return state.filter((dialog) => dialog.id !== action.id)
    default:
      return state
  }
}

const DialogContext = createContext<
  | {
      alert: (title: string, message?: React.ReactNode) => Promise<void>
      confirm: (title: string, message?: React.ReactNode) => Promise<boolean>
      prompt: (
        title: string,
        message?: React.ReactNode,
        defaultValue?: string,
      ) => Promise<string | null>
    }
  | undefined
>(undefined)

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialogs, dispatch] = useReducer(dialogReducer, [])
  const dialogCounter = useRef(0)

  const pushDialog = useCallback(
    (
      dialog:
        | Omit<AlertDialogType, "id">
        | Omit<ConfirmDialogType, "id">
        | Omit<PromptDialogType, "id">,
    ) => {
      const id = dialogCounter.current++
      dispatch({ type: "PUSH_DIALOG", dialog: { ...dialog, id } })
    },
    [],
  )

  const removeDialog = useCallback((id: number) => {
    dispatch({ type: "REMOVE_DIALOG", id })
  }, [])

  const alert = useCallback(
    (title: string, message?: React.ReactNode): Promise<void> => {
      return new Promise((resolve) => {
        pushDialog({ type: "alert", title, message, resolve })
      })
    },
    [pushDialog],
  )

  const confirm = useCallback(
    (title: string, message?: React.ReactNode): Promise<boolean> => {
      return new Promise((resolve) => {
        pushDialog({ type: "confirm", title, message, resolve })
      })
    },
    [pushDialog],
  )

  const prompt = useCallback(
    (title: string, message?: React.ReactNode, defaultValue?: string): Promise<string | null> => {
      return new Promise((resolve) => {
        pushDialog({ type: "prompt", title, message, defaultValue, resolve })
      })
    },
    [pushDialog],
  )

  useEffect(() => {
    dialogService.register({ alert, confirm, prompt })
  }, [alert, confirm, prompt])

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      {dialogs.map((dialog) => {
        switch (dialog.type) {
          case "alert":
            return (
              <AlertDialog
                key={dialog.id}
                open
                title={dialog.title}
                message={dialog.message}
                onClose={() => {
                  dialog.resolve()
                  removeDialog(dialog.id)
                }}
              />
            )
          case "confirm":
            return (
              <ConfirmDialog
                key={dialog.id}
                open
                title={dialog.title}
                message={dialog.message}
                onCancel={() => {
                  dialog.resolve(false)
                  removeDialog(dialog.id)
                }}
                onConfirm={() => {
                  dialog.resolve(true)
                  removeDialog(dialog.id)
                }}
              />
            )
          case "prompt":
            return (
              <PromptDialog
                key={dialog.id}
                open
                title={dialog.title}
                message={dialog.message}
                defaultValue={dialog.defaultValue}
                onCancel={() => {
                  dialog.resolve(null)
                  removeDialog(dialog.id)
                }}
                onConfirm={(value) => {
                  dialog.resolve(value)
                  removeDialog(dialog.id)
                }}
              />
            )
        }
      })}
    </DialogContext.Provider>
  )
}

export const useDialog = () => {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider")
  }
  return context
}

export default DialogProvider

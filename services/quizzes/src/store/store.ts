import { TypedUseSelectorHook, useSelector } from "react-redux"
import { combineReducers, createStore } from "redux"
import { composeWithDevTools } from "redux-devtools-extension"

import { editorReducer, EditorStoreState } from "./editorStore"
import { widgetReducer, WidgetStoreState } from "./widgetStore"

const combinedReducer = combineReducers({ widget: widgetReducer, editor: editorReducer })

export interface StoreState {
  editor: EditorStoreState
  widget: WidgetStoreState
}

export const useTypedSelector: TypedUseSelectorHook<StoreState> = useSelector

const store = createStore(combinedReducer, composeWithDevTools())

export default store

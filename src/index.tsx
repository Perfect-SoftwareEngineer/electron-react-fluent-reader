import * as React from "react"
import * as ReactDOM from "react-dom"
import { Provider } from "react-redux"
import { createStore, applyMiddleware } from "redux"
import thunkMiddleware from "redux-thunk"
import { initializeIcons } from "@fluentui/react/lib/Icons"
import { rootReducer, RootState } from "./scripts/reducer"
import Root from "./components/root"
import { AppDispatch } from "./scripts/utils"
import { setProxy, applyThemeSettings } from "./scripts/settings"
import { initApp } from "./scripts/models/app"

setProxy()

applyThemeSettings()
initializeIcons("icons/")

const store = createStore(
    rootReducer,
    applyMiddleware<AppDispatch, RootState>(thunkMiddleware)
)

store.dispatch(initApp())

ReactDOM.render(
    <Provider store={store}>
        <Root />
    </Provider>,
    document.getElementById("app")
)
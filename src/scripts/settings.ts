import { remote, ipcRenderer } from "electron"
import { IPartialTheme, loadTheme } from "@fluentui/react"
import locales from "./i18n/_locales"
import Store = require("electron-store")
import { ThemeSettings, SchemaTypes } from "../schema-types"
import fs = require("fs")
import intl from "react-intl-universal"

export const store = new Store<SchemaTypes>()

const lightTheme: IPartialTheme = { 
    defaultFontStyle: { fontFamily: '"Segoe UI", "Source Han Sans SC Regular", "Microsoft YaHei", sans-serif' } 
}
const darkTheme: IPartialTheme = {
    ...lightTheme,
    palette: {
        neutralLighterAlt: "#282828",
        neutralLighter: "#313131",
        neutralLight: "#3f3f3f",
        neutralQuaternaryAlt: "#484848",
        neutralQuaternary: "#4f4f4f",
        neutralTertiaryAlt: "#6d6d6d",
        neutralTertiary: "#c8c8c8",
        neutralSecondary: "#d0d0d0",
        neutralSecondaryAlt: "#d2d0ce",
        neutralPrimaryAlt: "#dadada",
        neutralPrimary: "#ffffff",
        neutralDark: "#f4f4f4",
        black: "#f8f8f8",
        white: "#1f1f1f",
        themePrimary: "#3a96dd",
        themeLighterAlt: "#020609",
        themeLighter: "#091823",
        themeLight: "#112d43",
        themeTertiary: "#235a85",
        themeSecondary: "#3385c3",
        themeDarkAlt: "#4ba0e1",
        themeDark: "#65aee6",
        themeDarker: "#8ac2ec",
        accent: "#3a96dd"
    }
}

const THEME_STORE_KEY = "theme"
export function setThemeSettings(theme: ThemeSettings) {
    window.settings.setThemeSettings(theme)
    applyThemeSettings()
}
export function getThemeSettings(): ThemeSettings {
    return window.settings.getThemeSettings()
}
export function applyThemeSettings() {
    loadTheme(window.settings.shouldUseDarkColors() ? darkTheme : lightTheme)
}
window.settings.addThemeUpdateListener((shouldDark) => {
    loadTheme(shouldDark ? darkTheme : lightTheme)
})

export function getCurrentLocale() {
    let locale = window.settings.getCurrentLocale()
    return (locale in locales) ? locale : "en-US"
}

export function exportAll(path: string) {
    let output = {}
    for (let [key, value] of store) {
        output[key] = value
    }
    output["nedb"] = {}
    let openRequest = window.indexedDB.open("NeDB")
    openRequest.onsuccess = () => {
        let db = openRequest.result
        let objectStore = db.transaction("nedbdata").objectStore("nedbdata")
        let cursorRequest = objectStore.openCursor()
        cursorRequest.onsuccess = () => {
            let cursor = cursorRequest.result
            if (cursor) {
                output["nedb"][cursor.key] = cursor.value
                cursor.continue()
            } else {
                fs.writeFile(path, JSON.stringify(output), (err) => {
                    if (err) remote.dialog.showErrorBox(intl.get("settings.writeError"), String(err))
                })
            }
        }
    }
}

export function importAll(path) {
    fs.readFile(path, "utf-8", async (err, data) => {
        if (err) {
            console.log(err)
        } else {
            let configs = JSON.parse(data)
            let openRequest = window.indexedDB.open("NeDB")
            openRequest.onsuccess = () => {
                let db = openRequest.result
                let objectStore = db.transaction("nedbdata", "readwrite").objectStore("nedbdata")
                let requests = Object.entries(configs.nedb).map(([key, value]) => {
                    return objectStore.put(value, key)
                })
                let promises = requests.map(req => new Promise((resolve, reject) => {
                    req.onsuccess = () => resolve()
                    req.onerror = () => reject()
                }))
                Promise.all(promises).then(() => {
                    delete configs.nedb
                    store.clear()
                    let hasTheme = false
                    for (let [key, value] of Object.entries(configs)) {
                        if (key === THEME_STORE_KEY) {
                            setThemeSettings(value as ThemeSettings)
                            hasTheme = true
                        } else {
                            // @ts-ignore
                            store.set(key, value)
                        }
                    }
                    if (!hasTheme) setThemeSettings(ThemeSettings.Default)
                    ipcRenderer.send("restart")
                })
            }
        }
    })
}

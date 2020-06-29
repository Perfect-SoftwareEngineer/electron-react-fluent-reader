import fs = require("fs")
import intl from "react-intl-universal"
import { SourceActionTypes, ADD_SOURCE, DELETE_SOURCE, addSource, RSSSource } from "./source"
import { SourceGroup } from "../../schema-types"
import { ActionStatus, AppThunk, domParser, AppDispatch } from "../utils"
import { saveSettings } from "./app"
import { fetchItemsIntermediate, fetchItemsRequest, fetchItemsSuccess } from "./item"
import { remote } from "electron"

export const CREATE_SOURCE_GROUP = "CREATE_SOURCE_GROUP"
export const ADD_SOURCE_TO_GROUP = "ADD_SOURCE_TO_GROUP"
export const REMOVE_SOURCE_FROM_GROUP = "REMOVE_SOURCE_FROM_GROUP"
export const UPDATE_SOURCE_GROUP = "UPDATE_SOURCE_GROUP"
export const REORDER_SOURCE_GROUPS = "REORDER_SOURCE_GROUPS"
export const DELETE_SOURCE_GROUP = "DELETE_SOURCE_GROUP"
export const TOGGLE_GROUP_EXPANSION = "TOGGLE_GROUP_EXPANSION"

interface CreateSourceGroupAction {
    type: typeof CREATE_SOURCE_GROUP,
    group: SourceGroup
}

interface AddSourceToGroupAction {
    type: typeof ADD_SOURCE_TO_GROUP,
    groupIndex: number,
    sid: number
}

interface RemoveSourceFromGroupAction {
    type: typeof REMOVE_SOURCE_FROM_GROUP,
    groupIndex: number,
    sids: number[]
}

interface UpdateSourceGroupAction {
    type: typeof UPDATE_SOURCE_GROUP,
    groupIndex: number,
    group: SourceGroup
}

interface ReorderSourceGroupsAction {
    type: typeof REORDER_SOURCE_GROUPS,
    groups: SourceGroup[]
}

interface DeleteSourceGroupAction {
    type: typeof DELETE_SOURCE_GROUP,
    groupIndex: number
}

interface ToggleGroupExpansionAction {
    type: typeof TOGGLE_GROUP_EXPANSION,
    groupIndex: number
}

export type SourceGroupActionTypes = CreateSourceGroupAction | AddSourceToGroupAction 
    | RemoveSourceFromGroupAction | UpdateSourceGroupAction | ReorderSourceGroupsAction 
    | DeleteSourceGroupAction | ToggleGroupExpansionAction

export function createSourceGroupDone(group: SourceGroup): SourceGroupActionTypes {
    return {
        type: CREATE_SOURCE_GROUP,
        group: group
    }
}

export function createSourceGroup(name: string): AppThunk<number> {
    return (dispatch, getState) => {
        let group = new SourceGroup([], name)
        dispatch(createSourceGroupDone(group))
        let groups = getState().groups
        window.settings.saveGroups(groups)
        return groups.length - 1
    }
}

function addSourceToGroupDone(groupIndex: number, sid: number): SourceGroupActionTypes {
    return {
        type: ADD_SOURCE_TO_GROUP,
        groupIndex: groupIndex,
        sid: sid
    }
}

export function addSourceToGroup(groupIndex: number, sid: number): AppThunk {
    return (dispatch, getState) => {
        dispatch(addSourceToGroupDone(groupIndex, sid))
        window.settings.saveGroups(getState().groups)
    }
}

function removeSourceFromGroupDone(groupIndex: number, sids: number[]): SourceGroupActionTypes {
    return {
        type: REMOVE_SOURCE_FROM_GROUP,
        groupIndex: groupIndex,
        sids: sids
    }
}

export function removeSourceFromGroup(groupIndex: number, sids: number[]): AppThunk {
    return (dispatch, getState) => {
        dispatch(removeSourceFromGroupDone(groupIndex, sids))
        window.settings.saveGroups(getState().groups)
    }
}

function deleteSourceGroupDone(groupIndex: number): SourceGroupActionTypes {
    return {
        type: DELETE_SOURCE_GROUP,
        groupIndex: groupIndex
    }
}

export function deleteSourceGroup(groupIndex: number): AppThunk {
    return (dispatch, getState) => {
        dispatch(deleteSourceGroupDone(groupIndex))
        window.settings.saveGroups(getState().groups)
    }
}

function updateSourceGroupDone(group: SourceGroup): SourceGroupActionTypes {
    return {
        type: UPDATE_SOURCE_GROUP,
        groupIndex: group.index,
        group: group
    }
}

export function updateSourceGroup(group: SourceGroup): AppThunk {
    return (dispatch, getState) => {
        dispatch(updateSourceGroupDone(group))
        window.settings.saveGroups(getState().groups)
    }
}

function reorderSourceGroupsDone(groups: SourceGroup[]): SourceGroupActionTypes {
    return {
        type: REORDER_SOURCE_GROUPS,
        groups: groups
    }
}

export function reorderSourceGroups(groups: SourceGroup[]): AppThunk {
    return (dispatch, getState) => {
        dispatch(reorderSourceGroupsDone(groups))
        window.settings.saveGroups(getState().groups)
    }
}

export function toggleGroupExpansion(groupIndex: number): AppThunk {
    return (dispatch, getState) => {
        dispatch({
            type: TOGGLE_GROUP_EXPANSION,
            groupIndex: groupIndex
        })
        window.settings.saveGroups(getState().groups)
    }
}

function outlineToSource(outline: Element): [ReturnType<typeof addSource>, string] {
    let url = outline.getAttribute("xmlUrl")
    let name = outline.getAttribute("text") || outline.getAttribute("name")
    if (url) {
        return [addSource(url.trim(), name, true), url]
    } else {
        return null
    }
}

export function importOPML(path: string): AppThunk {
    return async (dispatch) => {
        fs.readFile(path, "utf-8", async (err, data) => {
            if (err) {
                console.log(err)
            } else {
                dispatch(saveSettings())
                let doc = domParser.parseFromString(data, "text/xml").getElementsByTagName("body")
                if (doc.length == 0) {
                    dispatch(saveSettings())
                    return
                }
                let parseError = doc[0].getElementsByTagName("parsererror")
                if (parseError.length > 0) {
                    dispatch(saveSettings())
                    remote.dialog.showErrorBox(intl.get("sources.errorParse"), intl.get("sources.errorParseHint"))
                    return
                }
                let sources: [ReturnType<typeof addSource>, number, string][] = []
                let errors: [string, any][] = []
                for (let el of doc[0].children) {
                    if (el.getAttribute("type") === "rss") {
                        let source = outlineToSource(el)
                        if (source) sources.push([source[0], -1, source[1]])
                    } else if (el.hasAttribute("text") || el.hasAttribute("title")) {
                        let groupName = el.getAttribute("text") || el.getAttribute("title")
                        let gid = dispatch(createSourceGroup(groupName))
                        for (let child of el.children) {
                            let source = outlineToSource(child)
                            if (source) sources.push([source[0], gid, source[1]])
                        }
                    }
                }
                dispatch(fetchItemsRequest(sources.length))
                let promises = sources.map(([s, gid, url]) => {
                    return dispatch(s).then(sid => {
                        if (sid !== null) dispatch(addSourceToGroup(gid, sid))
                    }).catch(err => {
                        errors.push([url, err])
                    }).finally(() => {
                        dispatch(fetchItemsIntermediate())
                    })
                })
                Promise.allSettled(promises).then(() => {
                    dispatch(fetchItemsSuccess([], {}))
                    dispatch(saveSettings())
                    if (errors.length > 0) {
                        remote.dialog.showErrorBox(
                            intl.get("sources.errorImport", { count: errors.length }), 
                            errors.map(e => {
                                return e[0] + "\n" + String(e[1])
                            }).join("\n")
                        )
                    }
                })
            }
        })
    }
}

function sourceToOutline(source: RSSSource, xml: Document) {
    let outline = xml.createElement("outline")
    outline.setAttribute("text", source.name)
    outline.setAttribute("name", source.name)
    outline.setAttribute("type", "rss")
    outline.setAttribute("xmlUrl", source.url)
    return outline
}

export function exportOPML(path: string): AppThunk {
    return (_, getState) => {
        let state = getState()
        let xml = domParser.parseFromString(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?><opml version=\"1.0\"><head><title>Fluent Reader Export</title></head><body></body></opml>", 
            "text/xml"
        )
        let body = xml.getElementsByTagName("body")[0]
        for (let group of state.groups) {
            if (group.isMultiple) {
                let outline = xml.createElement("outline")
                outline.setAttribute("text", group.name)
                outline.setAttribute("name", group.name)
                for (let sid of group.sids) {
                    outline.appendChild(sourceToOutline(state.sources[sid], xml))
                }
                body.appendChild(outline)
            } else {
                body.appendChild(sourceToOutline(state.sources[group.sids[0]], xml))
            }
        }
        let serializer = new XMLSerializer()
        fs.writeFile(path, serializer.serializeToString(xml), (err) => {
            if (err) remote.dialog.showErrorBox(intl.get("settings.writeError"), String(err))
        })
    }
    
}

export type GroupState = SourceGroup[]

export function groupReducer(
    state = window.settings.loadGroups(),
    action: SourceActionTypes | SourceGroupActionTypes
): GroupState {
    switch(action.type) {
        case ADD_SOURCE:
            switch (action.status) {
                case ActionStatus.Success: return [
                    ...state,
                    new SourceGroup([action.source.sid])
                ]
                default: return state
            }
        case DELETE_SOURCE: return [
            ...state.map(group => ({
                ...group,
                sids: group.sids.filter(sid => sid != action.source.sid)
            })).filter(g => g.isMultiple || g.sids.length == 1)
        ]
        case CREATE_SOURCE_GROUP: return [ ...state, action.group ]
        case ADD_SOURCE_TO_GROUP: return state.map((g, i) => i == action.groupIndex ? ({
            ...g,
            sids: [ ...g.sids, action.sid ]
        }) : g).filter(g => g.isMultiple || !g.sids.includes(action.sid))
        case REMOVE_SOURCE_FROM_GROUP: return [
            ...state.slice(0, action.groupIndex),
            { 
                ...state[action.groupIndex],
                sids: state[action.groupIndex].sids.filter(sid => !action.sids.includes(sid))
            },
            ...action.sids.map(sid => new SourceGroup([sid])),
            ...state.slice(action.groupIndex + 1)
        ]
        case UPDATE_SOURCE_GROUP: return [ 
            ...state.slice(0, action.groupIndex),
            action.group,
            ...state.slice(action.groupIndex + 1)
        ]
        case REORDER_SOURCE_GROUPS: return action.groups
        case DELETE_SOURCE_GROUP: return [
            ...state.slice(0, action.groupIndex),
            ...state[action.groupIndex].sids.map(sid => new SourceGroup([sid])),
            ...state.slice(action.groupIndex + 1)
        ]
        case TOGGLE_GROUP_EXPANSION: return state.map((g, i) => i == action.groupIndex ? ({
            ...g,
            expanded: !g.expanded
        }) : g)
        default: return state
    }
}
import intl from "react-intl-universal"
import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../../scripts/reducer"
import SourcesTab from "../../components/settings/sources"
import { addSource, RSSSource, updateSource, deleteSource, SourceOpenTarget, deleteSources } from "../../scripts/models/source"
import { importOPML, exportOPML } from "../../scripts/models/group"
import { AppDispatch, validateFavicon } from "../../scripts/utils"
import { saveSettings } from "../../scripts/models/app"
import { SyncService } from "../../schema-types"

const getSources = (state: RootState) => state.sources
const getServiceOn = (state: RootState) => state.service.type !== SyncService.None

const mapStateToProps = createSelector(
    [getSources, getServiceOn],
    (sources, serviceOn) => ({
        sources: sources,
        serviceOn: serviceOn
    })
)

const mapDispatchToProps = (dispatch: AppDispatch) => {
    return { 
        addSource: (url: string) => dispatch(addSource(url)),
        updateSourceName: (source: RSSSource, name: string) => {
            dispatch(updateSource({ ...source, name: name } as RSSSource))
        },
        updateSourceIcon: async (source: RSSSource, iconUrl: string) => {
            dispatch(saveSettings())
            if (await validateFavicon(iconUrl)) {
                dispatch(updateSource({ ...source, iconurl: iconUrl }))
            } else {
                window.utils.showErrorBox(intl.get("sources.badIcon"), "")
            }
            dispatch(saveSettings())
        },
        updateSourceOpenTarget: (source: RSSSource, target: SourceOpenTarget) => {
            dispatch(updateSource({ ...source, openTarget: target } as RSSSource))
        },
        updateFetchFrequency: (source: RSSSource, frequency: number) => {
            dispatch(updateSource({ ...source, fetchFrequency: frequency } as RSSSource))
        },
        deleteSource: (source: RSSSource) => dispatch(deleteSource(source)),
        deleteSources: (sources: RSSSource[]) => dispatch(deleteSources(sources)),
        importOPML: () => dispatch(importOPML()),
        exportOPML: () => dispatch(exportOPML())
    }
}

 const SourcesTabContainer = connect(mapStateToProps, mapDispatchToProps)(SourcesTab)
 export default SourcesTabContainer
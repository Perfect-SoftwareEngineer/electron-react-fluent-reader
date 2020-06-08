import * as React from "react"
import { RSSItem } from "../../scripts/models/item"
import { FeedReduxProps } from "../../containers/feed-container"
import { RSSFeed, FeedIdType } from "../../scripts/models/feed"
import { ViewType } from "../../scripts/models/page"
import CardsFeed from "./cards-feed"
import ListFeed from "./list-feed"

export type FeedProps = FeedReduxProps & {
    feed: RSSFeed
    viewType: ViewType
    items: RSSItem[]
    sourceMap: Object
    markRead: (item: RSSItem) => void
    contextMenu: (feedId: FeedIdType, item: RSSItem, e) => void
    loadMore: (feed: RSSFeed) => void
    showItem: (fid: FeedIdType, item: RSSItem) => void
}

export class Feed extends React.Component<FeedProps> { 
    render() {
        switch (this.props.viewType) {
            case (ViewType.Cards): return (
                <CardsFeed {...this.props} />
            )
            case (ViewType.List): return (
                <ListFeed {...this.props} />
            )
        }
    }
}
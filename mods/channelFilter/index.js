import { GRID, PIVOT, SHELF, TILES, configRead, keepShelf, keepTile } from '../../framework/index.js';
import { normal } from '../channels/index.js';

const first = (...candidates) => candidates.find((value) => typeof value === 'string' && value) || '';

const textOf = (text) => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    if (Array.isArray(text.runs)) return text.runs.map((run) => run.text).join('');

    return first(text.simpleText, text.content);
};

// A tile's title and its channel line, whichever of the two families of tile it is.
const detailsOf = (item) => {
    const tile = item.tileRenderer && item.tileRenderer.metadata && item.tileRenderer.metadata.tileMetadataRenderer;

    if (tile) {
        const line = tile.lines && tile.lines[0] && tile.lines[0].lineRenderer;
        const lead = line && line.items && line.items[0] && line.items[0].lineItemRenderer;

        return { title: textOf(tile.title), channel: textOf(lead && lead.text) };
    }

    // Search results arrive as lockups.
    const lockup = item.lockupViewModel && item.lockupViewModel.metadata
        && item.lockupViewModel.metadata.lockupMetadataViewModel;

    if (lockup) {
        const rows = lockup.metadata && lockup.metadata.contentMetadataViewModel
            && lockup.metadata.contentMetadataViewModel.metadataRows;
        const part = rows && rows[0] && rows[0].metadataParts && rows[0].metadataParts[0];

        return { title: textOf(lockup.title), channel: textOf(part && part.text) };
    }

    return null;
};

const filtering = () => (configRead('blockedChannels') || []).length > 0
    || (configRead('blockedKeywords') || []).length > 0;

keepTile('blocked channels and words', [SHELF, PIVOT, TILES, GRID], (item) => {
    const channels = configRead('blockedChannels') || [];
    const words = configRead('blockedKeywords') || [];

    if (!channels.length && !words.length) return true;

    const details = detailsOf(item);
    if (!details) return true;

    const channel = normal(details.channel);
    const title = normal(details.title);

    if (channel && channels.some((entry) => normal(entry) === channel)) return false;

    return !words.some((word) => normal(word) && title.indexOf(normal(word)) !== -1);
});

// A row left with nothing in it looks like a fault, so it goes too; only while a filter is on.
keepShelf('shelves emptied by the filter', [SHELF, PIVOT], (shelf) => {
    if (!filtering()) return true;

    const content = shelf.shelfRenderer && shelf.shelfRenderer.content;
    const items = content && content.horizontalListRenderer && content.horizontalListRenderer.items;

    return !items || items.length > 0;
});

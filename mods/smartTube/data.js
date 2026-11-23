// YouTube's TV answers, read into what the SmartTube-style screen draws: rows of cards. A row is a
// shelf (a title and a list of tiles) or a grid (subscriptions, history), cut into rows of a screen's
// width. A card keeps YouTube's own command for it, so a video, a playlist and a channel each open the
// way YouTube opens them.

const GRID_ROW = 5;

const text = (node) => {
    if (!node) return '';
    if (typeof node.simpleText === 'string') return node.simpleText;
    if (Array.isArray(node.runs)) return node.runs.map((run) => run.text || '').join('');
    return '';
};

const httpsOf = (url) => (String(url || '').indexOf('//') === 0 ? `https:${url}` : String(url || ''));

// The picture nearest a card's width, but not smaller where a bigger one is offered.
const pictureOf = (thumbnails) => {
    const list = Array.isArray(thumbnails) ? thumbnails.filter((one) => one && one.url) : [];
    if (!list.length) return '';
    const big = list.filter((one) => (one.width || 0) >= 320).sort((a, b) => (a.width || 0) - (b.width || 0));
    return httpsOf((big[0] || list[list.length - 1]).url);
};

const badgeOf = (header) => {
    const overlays = (header && header.thumbnailOverlays) || [];
    const time = overlays.map((overlay) => overlay && overlay.thumbnailOverlayTimeStatusRenderer).filter(Boolean)[0];
    if (!time) return '';
    return time.style === 'LIVE' ? 'LIVE' : text(time.text);
};

// The parts of a line (views, age) with a dot between each, as YouTube writes them; its own dots are
// not doubled.
const linesOf = (metadata) => ((metadata && metadata.lines) || []).map((line) => ((line.lineRenderer && line.lineRenderer.items) || [])
    .map((item) => text(item.lineItemRenderer && item.lineItemRenderer.text).replace(/\s+/g, ' ').trim())
    .filter((part) => part && part !== '\u2022' && part !== '\u00b7').join(' \u2022 '))
    .filter(Boolean);

const KINDS = {
    TILE_CONTENT_TYPE_VIDEO: 'video', TILE_CONTENT_TYPE_PLAYLIST: 'playlist', TILE_CONTENT_TYPE_CHANNEL: 'channel', TILE_CONTENT_TYPE_SHORTS: 'short'
};

const cardOf = (tile) => {
    if (!tile || !tile.onSelectCommand) return null;
    const header = tile.header && tile.header.tileHeaderRenderer;
    const metadata = tile.metadata && tile.metadata.tileMetadataRenderer;
    const title = text(metadata && metadata.title);
    if (!title) return null;

    return {
        id: tile.contentId || '',
        kind: KINDS[tile.contentType] || 'video',
        title,
        lines: linesOf(metadata),
        picture: pictureOf(header && header.thumbnail && header.thumbnail.thumbnails),
        badge: badgeOf(header),
        command: tile.onSelectCommand
    };
};

// YouTube's newer cards (search results, and more of its pages as it moves to them).
const LOCKUP_KINDS = {
    LOCKUP_CONTENT_TYPE_VIDEO: 'video', LOCKUP_CONTENT_TYPE_SHORT: 'short', LOCKUP_CONTENT_TYPE_PLAYLIST: 'playlist',
    LOCKUP_CONTENT_TYPE_CHANNEL: 'channel', LOCKUP_CONTENT_TYPE_PODCAST: 'playlist'
};

const content = (node) => (node && typeof node.content === 'string' ? node.content : text(node));

const lockupOf = (lockup) => {
    const context = lockup && lockup.rendererContext && lockup.rendererContext.commandContext;
    const command = context && context.onTap && context.onTap.innertubeCommand;
    const metadata = lockup && lockup.metadata && lockup.metadata.lockupMetadataViewModel;
    const title = content(metadata && metadata.title);
    if (!command || !title) return null;

    const details = metadata.metadata && metadata.metadata.contentMetadataViewModel;
    const lines = ((details && details.metadataRows) || []).map((row) => (row.metadataParts || [])
        .map((part) => content(part.text)).filter(Boolean).join(' \u2022 ')).filter(Boolean);
    const image = lockup.contentImage && (lockup.contentImage.thumbnailViewModel || lockup.contentImage.collectionThumbnailViewModel
        && lockup.contentImage.collectionThumbnailViewModel.primaryThumbnail && lockup.contentImage.collectionThumbnailViewModel.primaryThumbnail.thumbnailViewModel);
    const overlays = (image && image.overlays) || [];
    const badge = overlays.map((overlay) => {
        const bottom = overlay.thumbnailBottomOverlayViewModel;
        const first = bottom && bottom.badges && bottom.badges[0] && bottom.badges[0].thumbnailBadgeViewModel;
        return first && first.text;
    }).filter(Boolean)[0] || '';

    return {
        id: lockup.contentId || '',
        kind: LOCKUP_KINDS[lockup.contentType] || 'video',
        title,
        lines,
        picture: pictureOf(image && image.image && image.image.sources),
        badge,
        command
    };
};

const tilesIn = (node, out) => {
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node)) {
        node.forEach((one) => tilesIn(one, out));
        return out;
    }
    if (node.tileRenderer || node.lockupViewModel) {
        const card = node.tileRenderer ? cardOf(node.tileRenderer) : lockupOf(node.lockupViewModel);
        if (card) out.push(card);
        return out;
    }
    Object.keys(node).forEach((key) => tilesIn(node[key], out));
    return out;
};

const shelfTitle = (shelf) => {
    const header = shelf.headerRenderer && shelf.headerRenderer.shelfHeaderRenderer;
    const lockup = header && header.avatarLockup && header.avatarLockup.avatarLockupRenderer;
    return text(lockup && lockup.title) || text(shelf.title) || text(header && header.title) || '';
};

const chunk = (cards, size) => Array.from({ length: Math.ceil(cards.length / size) }, (_, at) => cards.slice(at * size, at * size + size));

// Every shelf and grid in the answer, in order.
const rowsIn = (node, out) => {
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node)) {
        node.forEach((one) => rowsIn(one, out));
        return out;
    }
    if (node.shelfRenderer) {
        const cards = tilesIn(node.shelfRenderer.content, []);
        if (cards.length) out.push({ title: shelfTitle(node.shelfRenderer), cards });
        return out;
    }
    if (node.gridRenderer) {
        const cards = tilesIn(node.gridRenderer.items, []);
        chunk(cards, GRID_ROW).forEach((part, at) => out.push({ title: at === 0 ? text(node.gridRenderer.header && node.gridRenderer.header.gridHeaderRenderer
            && node.gridRenderer.header.gridHeaderRenderer.title) : '', cards: part }));
        return out;
    }
    Object.keys(node).forEach((key) => {
        if (key !== 'frameworkUpdates' && key !== 'responseContext') rowsIn(node[key], out);
    });
    return out;
};

// Where more rows of this page are, if YouTube said.
const continuationOf = (answer) => {
    const found = [];
    const look = (node, depth) => {
        if (!node || typeof node !== 'object' || depth > 14 || found.length) return;
        if (node.sectionListRenderer || node.sectionListContinuation) {
            const list = node.sectionListRenderer || node.sectionListContinuation;
            const next = (list.continuations || []).map((one) => one.nextContinuationData && one.nextContinuationData.continuation).filter(Boolean)[0];
            if (next) found.push(next);
            return;
        }
        Object.keys(node).forEach((key) => look(node[key], depth + 1));
    };
    look(answer, 0);
    return found[0] || null;
};

const pageOf = (answer) => ({ rows: rowsIn(answer, []), more: continuationOf(answer) });

export { pageOf, rowsIn, cardOf, lockupOf, continuationOf, text, GRID_ROW };

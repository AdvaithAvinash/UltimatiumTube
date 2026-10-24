// Channel tracking, hiding by channel and word, speed per channel, and what the phone may change.

import assert from 'assert';
import { check, withConfig, through, finish } from '../harness.js';

global.document = { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => undefined };
global.CustomEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };

const { interceptJson } = await import('../../framework/registries/json.js');
const { configRead, configWrite, configAccepts, configSnapshot } = await import('../../framework/runtime/config.js');
await import('../../mods/feed/index.js');
const { noteVideo, currentChannel } = await import('../../mods/channels/index.js');
await import('../../mods/channelFilter/index.js');
const { rememberSpeedForChannel } = await import('../../mods/player/speed.js');
const { apply, phoneAddress } = await import('../../mods/phone/index.js');
const { phoneSchema } = await import('../../mods/settings/phoneSchema.js');
const { GROUPS } = await import('../../mods/settings/settingsModel.js');

interceptJson();

const surface = (items) => ({
    contents: {
        tvBrowseRenderer: {
            content: {
                tvSurfaceContentRenderer: {
                    content: {
                        sectionListRenderer: {
                            contents: [{ shelfRenderer: { content: { horizontalListRenderer: { items } } } }]
                        }
                    }
                }
            }
        }
    }
});

const shelves = (out) => out.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents;
const tilesOf = (out) => shelves(out)[0].shelfRenderer.content.horizontalListRenderer.items;

const tile = (id, title, channel) => ({
    tileRenderer: {
        contentId: id,
        metadata: {
            tileMetadataRenderer: {
                title: { simpleText: title },
                lines: [{ lineRenderer: { items: [{ lineItemRenderer: { text: { simpleText: channel } } }] } }]
            }
        }
    }
});

const idsOf = (out) => tilesOf(out).map((item) => item.tileRenderer.contentId);

const items = () => [
    tile('a', 'Cooking pasta', 'Chef Anna'),
    tile('b', 'SPOILER: the ending explained', 'Movie Guy'),
    tile('c', 'Piano lesson', 'Sponsor Land')
];

check('with nothing hidden every tile stays', () => {
    assert.deepStrictEqual(idsOf(through(surface(items()))), ['a', 'b', 'c']);
});

check('a hidden channel is dropped, whatever its capitals', () => {
    withConfig({ blockedChannels: ['sponsor LAND'] }, () => {
        assert.deepStrictEqual(idsOf(through(surface(items()))), ['a', 'b']);
    });
});

check('a hidden word is dropped from the title, whatever its capitals', () => {
    withConfig({ blockedKeywords: ['spoiler'] }, () => {
        assert.deepStrictEqual(idsOf(through(surface(items()))), ['a', 'c']);
    });
});

check('a word is not looked for in the channel name', () => {
    withConfig({ blockedKeywords: ['anna'] }, () => {
        assert.deepStrictEqual(idsOf(through(surface(items()))), ['a', 'b', 'c']);
    });
});

check('a blank entry hides nothing', () => {
    withConfig({ blockedKeywords: ['', '  '], blockedChannels: [''] }, () => {
        assert.deepStrictEqual(idsOf(through(surface(items()))), ['a', 'b', 'c']);
    });
});

check('a search lockup is filtered the same way', () => {
    const lockup = (id, title, channel) => ({
        lockupViewModel: {
            contentId: id,
            metadata: { lockupMetadataViewModel: {
                title: { content: title },
                metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: channel } }] }] } }
            } }
        }
    });

    withConfig({ blockedChannels: ['Movie Guy'], blockedKeywords: ['pasta'] }, () => {
        const out = through(surface([lockup('x', 'Cooking pasta', 'Chef Anna'), lockup('y', 'Trailer', 'Movie Guy'), lockup('z', 'Piano', 'Other')]));
        assert.deepStrictEqual(tilesOf(out).map((item) => item.lockupViewModel.contentId), ['z']);
    });
});

check('a tile of a shape we do not know is left alone', () => {
    withConfig({ blockedKeywords: ['x'] }, () => {
        assert.strictEqual(tilesOf(through(surface([{ somethingElse: {} }]))).length, 1);
    });
});

check('a row left empty by the filter is dropped, and only then', () => {
    const lone = () => surface([tile('b', 'SPOILER one', 'Movie Guy')]);

    withConfig({ blockedKeywords: ['spoiler'] }, () => assert.strictEqual(shelves(through(lone())).length, 0));
    assert.strictEqual(shelves(through(surface([]))).length, 1);
});

check('a played video is remembered as the current channel and a recent one', () => {
    noteVideo({ videoId: 'v1', author: 'Chef Anna' });
    noteVideo({ videoId: 'v2', author: 'Movie Guy' });
    noteVideo({ videoId: 'v3', author: 'Chef Anna' });

    assert.strictEqual(currentChannel(), 'Chef Anna');
    assert.deepStrictEqual(configRead('recentChannels').slice(0, 2), ['Chef Anna', 'Movie Guy']);
});

check('a response without an author changes nothing', () => {
    noteVideo({ videoId: 'v4' });
    noteVideo(undefined);
    assert.strictEqual(currentChannel(), 'Chef Anna');
});

check('the recent list is capped', () => {
    Array.from({ length: 50 }, (_, n) => n).forEach((n) => noteVideo({ videoId: `n${n}`, author: `Channel ${n}` }));
    assert.strictEqual(configRead('recentChannels').length, 30);
});

check('a speed chosen on a channel is kept for it, when the setting is on', () => {
    noteVideo({ videoId: 'p', author: 'Podcast Show' });

    withConfig({ rememberChannelSpeed: true, channelSpeeds: {} }, () => {
        rememberSpeedForChannel(1.5);
        assert.deepStrictEqual(configRead('channelSpeeds'), { 'podcast show': 1.5 });

        rememberSpeedForChannel(1);
        assert.deepStrictEqual(configRead('channelSpeeds'), {});
    });
});

check('with the setting off nothing is kept', () => {
    withConfig({ rememberChannelSpeed: false, channelSpeeds: {} }, () => {
        rememberSpeedForChannel(2);
        assert.deepStrictEqual(configRead('channelSpeeds'), {});
    });
});

check('the phone may change a setting in the shape it already has', () => {
    assert.ok(configAccepts('enableAdBlock', false));
    assert.ok(configAccepts('blockedKeywords', ['a']));
    assert.ok(configAccepts('channelSpeeds', { x: 2 }));
    assert.ok(configAccepts('sponsorBlockMinDuration', 3));
});

check('and not in another, nor one that does not exist', () => {
    assert.ok(!configAccepts('enableAdBlock', 'yes'));
    assert.ok(!configAccepts('blockedKeywords', 'a'));
    assert.ok(!configAccepts('channelSpeeds', []));
    assert.ok(!configAccepts('channelSpeeds', null));
    assert.ok(!configAccepts('noSuchSetting', true));
    assert.ok(!configAccepts('hasOwnProperty', true));
});

check('changes from the phone are applied, and bad ones skipped', () => {
    const before = configRead('enableAdBlock');
    apply([
        { key: 'blockedKeywords', value: ['one', 'two'] },
        { key: 'enableAdBlock', value: 'nope' },
        { key: 'unknown', value: 1 }
    ]);

    assert.deepStrictEqual(configRead('blockedKeywords'), ['one', 'two']);
    assert.strictEqual(configRead('enableAdBlock'), before);
    configWrite('blockedKeywords', []);
});

check('the snapshot carries every setting', () => {
    const all = configSnapshot();
    assert.ok('enableSponsorBlock' in all && 'blockedChannels' in all && 'sponsorBlockMuteSegments' in all);
});

check('there is no phone address until the service has answered', () => {
    assert.strictEqual(phoneAddress(), '');
});

check('the phone page is described from the same rows as the TV, as plain data', () => {
    const schema = JSON.parse(JSON.stringify(phoneSchema()));
    const keys = schema.reduce((all, group) => all.concat(group.items.map((item) => item.key)), []);

    ['enableSponsorBlock', 'sponsorBlockMuteSegments', 'sponsorBlockMinDuration',
        'sponsorBlockExemptChannels', 'sponsorBlockSavedSeconds', 'blockedChannels',
        'blockedKeywords', 'rememberChannelSpeed', 'enableDeArrow'].forEach((key) => {
        assert.ok(keys.indexOf(key) !== -1, `${key} is missing from the phone page`);
    });

    assert.ok(keys.indexOf('phoneSettings') === -1, 'the row that points at the phone is on the phone');
});

check('lists of names are typed on the phone, the rest are ticked', () => {
    const find = (key) => phoneSchema().reduce((all, group) => all.concat(group.items), []).find((item) => item.key === key);

    assert.strictEqual(find('blockedKeywords').kind, 'words');
    assert.strictEqual(find('blockedChannels').kind, 'words');
    assert.strictEqual(find('sponsorBlockExemptChannels').kind, 'words');
    assert.strictEqual(find('sponsorBlockMuteSegments').kind, 'set');
    assert.strictEqual(find('sponsorBlockMinDuration').kind, 'choice');
    assert.strictEqual(find('enableAdBlock').kind, 'switch');
    assert.strictEqual(find('sponsorBlockSavedSeconds').kind, 'panel');
    assert.ok(find('sponsorBlockSavedSeconds').actions.length === 1);
});

check('every setting the model names is one the config knows', () => {
    const known = configSnapshot();
    const named = (item) => (item.kind === 'flags' ? item.options.map((option) => option.key) : [item.key]);
    const keys = GROUPS.reduce((all, group) => group.items.reduce((inner, item) => inner.concat(named(item)), all), []);

    keys.filter((key) => key !== 'phoneSettings').forEach((key) => {
        assert.ok(key in known, `${key} is shown in the settings but not in the config`);
    });
});

check('the pick lists offer what has been watched, plus what is already ticked', () => {
    withConfig({ recentChannels: ['A', 'B'], blockedChannels: ['Old one', 'A'] }, () => {
        const item = GROUPS.reduce((all, group) => all.concat(group.items), []).find((one) => one.key === 'blockedChannels');
        assert.deepStrictEqual(item.options.map((option) => option.value), ['A', 'B', 'Old one']);
    });
});

check('with nothing watched yet the list says what to do', () => {
    withConfig({ recentChannels: [], blockedChannels: [] }, () => {
        const item = GROUPS.reduce((all, group) => all.concat(group.items), []).find((one) => one.key === 'blockedChannels');
        assert.strictEqual(item.options.length, 1);
        assert.ok(item.options[0].label.indexOf('Play a video') === 0);
    });
});

finish();

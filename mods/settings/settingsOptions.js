import { buttonItem, configRead, overlayPanelItemListRenderer, showModal } from '../../framework/index.js';
import { at, chosenLabel, chosenSummary, isChosen, ultimateGroups } from './settingsModel.js';

const OPTIONS_ACTION = 'TUBE_OPTIONS';

const optionsCommand = (path, index, update) => ({
    customAction: {
        action: OPTIONS_ACTION,
        parameters: { path, index: index || 0, update: !!update }
    }
});

const actionCommand = (action) => ({ customAction: { action, parameters: {} } });

// Neither listValue nor objectValue is arrayValue, so both replace the setting outright.
const fieldFor = (value) => (typeof value === 'boolean' ? 'boolValue'
    : typeof value === 'number' ? 'intValue'
        : Array.isArray(value) ? 'listValue'
            : value !== null && typeof value === 'object' ? 'objectValue'
                : 'stringValue');

const settingData = (key, value) => ({ clientSettingEnum: { item: key }, [fieldFor(value)]: value });

function storeCommand(key, value) {
    return {
        setClientSettingEndpoint: { settingDatas: [settingData(key, value)] }
    };
}

// Several settings in one command, so a reset is a single step.
const writesCommand = (writes) => ({
    setClientSettingEndpoint: { settingDatas: writes.map((write) => settingData(write.key, write.value)) }
});

function toggleInSetCommand(key, value) {
    return {
        setClientSettingEndpoint: {
            settingDatas: [{ clientSettingEnum: { item: key }, arrayValue: value }]
        }
    };
}

const checkbox = (on) => (on ? 'CHECK_BOX' : 'CHECK_BOX_OUTLINE_BLANK');
const radio = (on) => (on ? 'RADIO_BUTTON_CHECKED' : 'RADIO_BUTTON_UNCHECKED');

const writeThenRedraw = (setting, path, index) => (setting
    ? [setting, optionsCommand(path, index, true)]
    : [optionsCommand(path, index, true)]);

function rowsFor(item, path) {
    if (item.kind === 'choice') {
        const current = configRead(item.key);
        return item.options.map((option, index) => buttonItem(
            { title: option.label },
            { secondaryIcon: radio(option.value === current) },
            writeThenRedraw(storeCommand(item.key, option.value), path, index)
        ));
    }

    if (item.kind === 'panel') {
        return item.options.map((option, index) => buttonItem(
            { title: option.label },
            null,
            writeThenRedraw(option.writes && option.writes.length ? writesCommand(option.writes) : null, path, index)
        ));
    }

    if (item.kind === 'flags') {
        return item.options.map((option, index) => buttonItem(
            { title: option.label },
            { secondaryIcon: checkbox(!!configRead(option.key)) },
            writeThenRedraw(storeCommand(option.key, !configRead(option.key)), path, index)
        ));
    }

    return item.options.map((option, index) => buttonItem(
        { title: option.label },
        { secondaryIcon: checkbox(isChosen(item, option.value)) },
        writeThenRedraw(toggleInSetCommand(item.key, option.value), path, index)
    ));
}

const said = (text) => (typeof text === 'function' ? text() : text);

const valueText = (item) => (item.kind === 'choice' ? `${item.prefix}: ${chosenLabel(item)}`
    : item.kind === 'panel' ? item.value()
        : chosenSummary(item));

// The first step: the Ultimate sections.
const menuRows = () => ultimateGroups().map((entry) => buttonItem(
    { title: entry.group.title, subtitle: entry.group.summary },
    null,
    [optionsCommand([entry.index])]
));

// A section: each of its settings as one row, a switch flipping where it stands and anything else
// opening its own list.
const groupRows = (group, groupIndex) => group.items.map((item, index) => {
    const title = { title: item.title, subtitle: said(item.summary) };

    if (item.kind === 'switch') {
        const enabled = configRead(item.key) === item.on;

        return buttonItem(title, { secondaryIcon: checkbox(enabled) },
            writeThenRedraw(storeCommand(item.key, enabled ? !item.on : item.on), [groupIndex], index));
    }

    if (item.kind === 'action') return buttonItem(title, null, [actionCommand(item.action)]);

    return buttonItem({ title: item.title, subtitle: valueText(item) }, null, [optionsCommand([groupIndex, index])]);
});

function openOptions(parameters) {
    const options = parameters || {};
    const path = options.path || [];
    const item = at(path);

    if (!item) return;

    const open = (shown, rows, id) => showModal(
        { title: shown.title, subtitle: said(shown.summary) },
        overlayPanelItemListRenderer(rows, options.index || 0),
        id,
        !!options.update
    );

    if (path[0] === 'ultimate') return open(item, menuRows(), 'tube-options-ultimate');
    if (path.length === 1) return open(item, groupRows(item, path[0]), `tube-options-${path[0]}`);
    if (!item.options) return undefined;

    return open(item, rowsFor(item, path), `tube-options-${path.join('-')}`);
}

export { actionCommand, openOptions, OPTIONS_ACTION, optionsCommand, storeCommand };

import { buttonItem, configRead, overlayPanelItemListRenderer, showModal } from '../../framework/index.js';
import { at, isChosen } from './settingsModel.js';

const OPTIONS_ACTION = 'TUBE_OPTIONS';

const optionsCommand = (path, index, update) => ({
    customAction: {
        action: OPTIONS_ACTION,
        parameters: { path, index: index || 0, update: !!update }
    }
});

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

function openOptions(parameters) {
    const options = parameters || {};
    const item = at(options.path || []);

    if (!item || !item.options) return;

    showModal(
        { title: item.title, subtitle: item.summary },
        overlayPanelItemListRenderer(rowsFor(item, options.path), options.index || 0),
        `tube-options-${options.path.join('-')}`,
        !!options.update
    );
}

export { openOptions, OPTIONS_ACTION, optionsCommand, storeCommand };

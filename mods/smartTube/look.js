// The look of the SmartTube UI: SmartTube's dark, quiet TV screens (a side menu, rows of cards, red
// where the focus is), with UltimatiumTube's name and mark where SmartTube's would be. Drawn at
// 1920 x 1080 and scaled to the screen.

const RED = '#e53935';

const CSS = `
#tube-smart { position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 2147482000;
  background-color: #0f0f10; overflow: hidden; font-family: Roboto, Arial, Helvetica, sans-serif; color: #eeeeee; }
#tube-smart .ust-stage { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; overflow: hidden;
  background: radial-gradient(ellipse at 70% -10%, rgba(229, 57, 53, 0.16) 0%, rgba(15, 15, 16, 0) 55%), #0f0f10; }
#tube-smart .ust-rail { position: absolute; left: 0; top: 0; width: 360px; height: 1080px; padding: 40px 0 0 0; box-sizing: border-box;
  background: linear-gradient(90deg, #17171a 0%, #141416 100%); border-right: 1px solid rgba(255, 255, 255, 0.06); }
#tube-smart .ust-logo { display: block; height: 72px; margin: 0 0 34px 36px; white-space: nowrap; }
#tube-smart .ust-logo svg { display: inline-block; vertical-align: middle; width: 64px; height: 64px; }
#tube-smart .ust-name { display: inline-block; vertical-align: middle; margin-left: 14px; font-size: 31px; font-weight: bold; letter-spacing: -0.5px; }
#tube-smart .ust-name-a { color: #ffffff; }
#tube-smart .ust-name-b { color: ${RED}; }
#tube-smart .ust-items { position: relative; }
#tube-smart .ust-item { position: relative; height: 56px; line-height: 56px; margin: 2px 22px 2px 22px; padding: 0 18px; border-radius: 28px;
  color: #b9b9bd; font-size: 25px; white-space: nowrap; overflow: hidden; }
#tube-smart .ust-item .ust-icon { display: inline-block; vertical-align: middle; width: 30px; height: 30px; margin-right: 20px; line-height: 0; }
#tube-smart .ust-item .ust-label { display: inline-block; vertical-align: middle; }
#tube-smart .ust-item.ust-current { color: #ffffff; }
#tube-smart .ust-item.ust-current:before { content: ''; position: absolute; left: 0; top: 14px; width: 5px; height: 28px; border-radius: 3px; background-color: ${RED}; }
#tube-smart.ust-in-rail .ust-item.ust-focus { background-color: #ffffff; color: #0f0f10; }
#tube-smart.ust-in-rail .ust-item.ust-focus:before { display: none; }
#tube-smart.ust-in-rows .ust-rail { opacity: 0.82; }
#tube-smart .ust-main { position: absolute; left: 360px; top: 0; width: 1560px; height: 1080px; }
#tube-smart .ust-top { position: absolute; left: 70px; right: 70px; top: 44px; height: 64px; }
#tube-smart .ust-title { position: absolute; left: 0; top: 0; font-size: 44px; font-weight: bold; color: #ffffff; }
#tube-smart .ust-clock { position: absolute; right: 0; top: 4px; font-size: 34px; color: #d8d8dc; }
#tube-smart .ust-view { position: absolute; left: 42px; right: 0; top: 128px; bottom: 0; overflow: hidden; }
#tube-smart .ust-rows { position: absolute; left: 0; right: 0; top: 0; transition: transform 0.22s ease-out; }
#tube-smart .ust-row { height: 412px; opacity: 0.55; transition: opacity 0.2s; }
#tube-smart .ust-row.ust-row-on { opacity: 1; }
#tube-smart .ust-row-title { height: 46px; padding-left: 28px; font-size: 28px; font-weight: bold; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 70px; }
#tube-smart .ust-strip { white-space: nowrap; transition: transform 0.2s ease-out; padding: 22px 0 0 28px; }
#tube-smart .ust-card { display: inline-block; vertical-align: top; width: 352px; margin-right: 30px; white-space: normal;
  transition: transform 0.16s ease-out; transform-origin: 50% 40%; }
#tube-smart .ust-thumb { position: relative; width: 352px; height: 198px; border-radius: 12px; overflow: hidden; background-color: #25252a; }
#tube-smart .ust-picture { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; }
#tube-smart .ust-badge { position: absolute; right: 10px; bottom: 10px; padding: 3px 8px; border-radius: 6px; font-size: 19px; font-weight: bold;
  background-color: rgba(0, 0, 0, 0.82); color: #ffffff; }
#tube-smart .ust-live { background-color: ${RED}; }
#tube-smart .ust-kind { position: absolute; left: 10px; top: 10px; padding: 3px 8px; border-radius: 6px; font-size: 17px; font-weight: bold;
  background-color: rgba(0, 0, 0, 0.78); color: #ffffff; }
#tube-smart .ust-card-title { margin-top: 14px; font-size: 23px; line-height: 30px; height: 60px; overflow: hidden; color: #e8e8ea; }
#tube-smart .ust-card-meta { margin-top: 6px; font-size: 19px; line-height: 26px; height: 26px; overflow: hidden; white-space: nowrap;
  text-overflow: ellipsis; color: #9d9da3; }
#tube-smart .ust-card.ust-focus { transform: scale(1.07); }
#tube-smart .ust-card.ust-focus .ust-thumb { box-shadow: 0 0 0 5px ${RED}, 0 10px 34px rgba(229, 57, 53, 0.45); }
#tube-smart .ust-card.ust-focus .ust-card-title { color: #ffffff; }
#tube-smart .ust-message { display: none; position: absolute; left: 28px; right: 70px; top: 30px; font-size: 30px; line-height: 44px; color: #cfcfd4; }
`;

// 24 x 24 shapes for the side menu.
const ICONS = {
    home: 'M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z',
    subs: 'M6 2h12v2H6zM4 6h16v2H4zm0 4h16v12H4zm6 3v6l5-3z',
    library: 'M4 4h4v16H4zm6 0h4v16h-4zm6.4 1.2l3.9 1-3.8 14.6-3.9-1z',
    history: 'M13 3a9 9 0 1 1-8.5 12h2.1A7 7 0 1 0 6 12H9l-4 4-4-4h3a9 9 0 0 1 9-9zm-1 5h2v4.4l3 1.8-1 1.7-4-2.4z',
    music: 'M9 3h10v4h-6v10.5A3.5 3.5 0 1 1 9 14.6z',
    game: 'M6 8h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5.4 1.8L15 15H9l-1.6 1.8A3 3 0 0 1 2 15v-3a4 4 0 0 1 4-4zm1 2v2H5v2h2v2h2v-2h2v-2H9v-2zm9 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    news: 'M3 5h14v14H5a2 2 0 0 1-2-2zm16 4h2v8a2 2 0 0 1-2 2zM6 8v3h8V8zm0 5v2h8v-2z',
    trophy: 'M7 3h10v2h4v3a4 4 0 0 1-4 4 5 5 0 0 1-4 3v3h4v3H7v-3h4v-3a5 5 0 0 1-4-3 4 4 0 0 1-4-4V5h4zM5 7v1a2 2 0 0 0 2 2V7zm12 0v3a2 2 0 0 0 2-2V7z',
    live: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM6.3 6.3l1.4 1.4a6 6 0 0 0 0 8.6l-1.4 1.4a8 8 0 0 1 0-11.4zm11.4 0a8 8 0 0 1 0 11.4l-1.4-1.4a6 6 0 0 0 0-8.6z',
    mic: 'M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-3.1A7 7 0 0 1 5 11z',
    film: 'M4 4h16v16H4zm2 2v2h2V6zm10 0v2h2V6zM6 10v4h12v-4zm0 6v2h2v-2zm10 0v2h2v-2z',
    search: 'M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    stremio: 'M4 5h16v11H4zm6 3v5l4-2.5zM8 18h8v2H8z',
    yt: 'M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm7 2v6l5-3z',
    gear: 'M10.5 2h3l.5 2.6 2.2 1.3 2.5-.9 1.5 2.6-2 1.7v1.4l2 1.7-1.5 2.6-2.5-.9-2.2 1.3-.5 2.6h-3l-.5-2.6-2.2-1.3-2.5.9-1.5-2.6 2-1.7V9.3l-2-1.7L5.3 5l2.5.9L10 4.6zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
};

// UltimatiumTube's mark: a play button lit from red into blue.
const LOGO = '<svg viewBox="0 0 64 64" width="64" height="64">'
    + '<defs><linearGradient id="ustMark" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0" stop-color="#ff4d4d"/><stop offset="0.55" stop-color="#e53935"/><stop offset="1" stop-color="#3ea6ff"/>'
    + '</linearGradient></defs>'
    + '<rect x="2" y="8" width="60" height="48" rx="14" fill="url(#ustMark)"/>'
    + '<path d="M26 20 L46 32 L26 44 Z" fill="#ffffff"/>'
    + '<rect x="2" y="8" width="60" height="48" rx="14" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>'
    + '</svg>';

export { CSS, ICONS, LOGO, RED };

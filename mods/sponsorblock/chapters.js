import { onResponse } from '../../framework/index.js';

// Intros, outros and recaps found from a video's own chapters, for the videos SponsorBlock has nothing
// for. A chapter list is the lines of the description that start with a time, from 0:00; a chapter
// whose title says what it is becomes a segment, running to the next chapter.

/** @type {Array<[string, RegExp]>} */
const KINDS = [
    ['intro', /^(intro(duction)?|opening( (credits|theme|song))?|op|cold open|title sequence)\b/i],
    ['outro', /^(outro|ending( (credits|theme|song))?|end( credits| screen| card)?|credits|ed|closing)\b/i],
    ['preview', /^(recap|previously( on)?|preview|coming up|next (time|episode)|trailer)\b/i],
    ['sponsor', /^(sponsor(ed)?( (segment|message|read|spot))?|ad( read| break)?|advertisement)\b/i],
    ['selfpromo', /^(merch|patreon|support (the|this) channel|subscribe)\b/i]
];

const LINE = /^\s*\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s*[-–—:|.)\]]*\s*(.+?)\s*$/;

const seconds = (stamp) => stamp.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);

const kindOf = (title) => {
    const clean = String(title).replace(/^[\s\-–—:|.#*\d)]+/, '').trim();
    const found = KINDS.find((kind) => kind[1].test(clean));
    return found ? found[0] : null;
};

// [{ segment: [start, end], category, UUID, actionType }]; none without a real chapter list.
const chaptersOf = (description, length) => {
    const marks = String(description || '').split('\n')
        .map((line) => LINE.exec(line))
        .filter(Boolean)
        .map((match) => ({ at: seconds(match[1]), title: match[2] }));

    // YouTube's own rule for chapters: the first at 0:00, at least three, in order.
    if (marks.length < 3 || marks[0].at !== 0) return [];
    if (marks.some((mark, i) => i > 0 && mark.at <= marks[i - 1].at)) return [];

    return marks.map((mark, i) => {
        const category = kindOf(mark.title);
        const end = i + 1 < marks.length ? marks[i + 1].at : length;
        return category && end > mark.at
            ? { segment: [mark.at, end], category, UUID: `chapter-${category}-${mark.at}`, actionType: 'skip', fromChapters: true }
            : null;
    }).filter(Boolean);
};

const found = {};

onResponse('chapter segments', ['videoDetails'], (response) => {
    const details = response.videoDetails;
    if (!details || !details.videoId) return;
    found[details.videoId] = chaptersOf(details.shortDescription, Number(details.lengthSeconds) || 0);
});

const chapterSegments = (videoId) => found[videoId] || [];

export { chaptersOf, chapterSegments, kindOf };

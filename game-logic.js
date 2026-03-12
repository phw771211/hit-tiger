/**
 * game-logic.js — pure game logic for 象棋吃墩
 *
 * This file is loaded as a plain <script> in the browser (globals)
 * and imported by Vitest for unit testing.
 * No DOM, no network, no Audio APIs — only data in, data out.
 */

/**
 * Classify a set of cards into a valid pattern, or return null.
 *
 * @param {Array<{n:string, v:number, r:boolean}>} cards
 * @returns {{name:string, pwr:number}|null}
 */
function getPattern(cards) {
    if (!cards || cards.length === 0) return null;
    const len = cards.length, ns = cards.map(c => c.n);
    const isAllRed = cards.every(c => c.r), isAllBlack = cards.every(c => !c.r);
    if (!isAllRed && !isAllBlack) return null;
    const vSum = cards.reduce((s, c) => s + c.v + (c.r ? 0.5 : 0), 0);
    if (len === 1) return { name: "單張", pwr: vSum };
    if ([...new Set(ns)].length === 1 && len >= 2) return { name: (len === 2 ? "對子" : "同子"), pwr: 1000 * len + vSum };
    if (len >= 3) {
        const groupA = isAllRed ? ['帥', '仕', '相'] : ['將', '士', '象'];
        const groupB = isAllRed ? ['俥', '瑪', '砲'] : ['車', '馬', '包'];
        const u = [...new Set(ns)];
        if (u.every(n => groupA.includes(n)) && groupA.every(n => u.includes(n))) return { name: "順子", pwr: 2000 * len + vSum };
        if (u.every(n => groupB.includes(n)) && groupB.every(n => u.includes(n))) return { name: "順子", pwr: 2000 * len + vSum };
    }
    return null;
}

/**
 * Calculate per-player score diffs for a completed round.
 * Baseline is 5 tricks; each trick above/below is ±20.
 * If any player sweeps all 8 tricks, all amounts are doubled.
 *
 * @param {number[]} finalTricks  - tricks won per seat [0..3], must sum to 8
 * @param {number}   lastWinnerIdx - seat index of the trick that ended the round
 * @returns {number[]} diffs - signed score change per seat (sums to 0)
 */
function calcSettlement(finalTricks, lastWinnerIdx) {
    let diffs = [0, 0, 0, 0], totalFlow = 0;
    const multiplier = finalTricks.some(t => t === 8) ? 2 : 1;
    for (let i = 0; i < 4; i++) {
        if (i !== lastWinnerIdx) {
            const d = (finalTricks[i] - 5) * 20 * multiplier;
            diffs[i] = d;
            totalFlow += d;
        }
    }
    diffs[lastWinnerIdx] = -totalFlow;
    return diffs;
}

/**
 * Sort a hand array: combos (straights) grouped first, then singles,
 * all ordered by descending value. Pure — returns new array, does not
 * mutate the input.
 *
 * @param {Array<{n:string, v:number, r:boolean, id:any}>} hand
 * @returns {Array} sorted hand
 */
function sortCards(hand) {
    const redA = ['帥', '仕', '相'], redB = ['俥', '瑪', '砲'];
    const blkA = ['將', '士', '象'], blkB = ['車', '馬', '包'];

    function extractCombo(pool, group) {
        const names = pool.map(c => c.n);
        if (!group.every(n => names.includes(n))) return null;
        return pool.filter(c => group.includes(c.n));
    }

    const usedIds = new Set();
    const comboItems = [];

    [
        [hand.filter(c =>  c.r), redA, 7],
        [hand.filter(c =>  c.r), redB, 4],
        [hand.filter(c => !c.r), blkA, 7],
        [hand.filter(c => !c.r), blkB, 4],
    ].forEach(([pool, group, anchor]) => {
        const available = pool.filter(c => !usedIds.has(c.id));
        const combo = extractCombo(available, group);
        if (combo) {
            combo.forEach(c => usedIds.add(c.id));
            const isRed = combo[0].r;
            combo.sort((a, b) => b.v - a.v || (a.r ? -1 : 1));
            comboItems.push({ cards: combo, key: anchor + (isRed ? 0.5 : 0) });
        }
    });

    const singleItems = hand
        .filter(c => !usedIds.has(c.id))
        .sort((a, b) => b.v - a.v || (a.r ? -1 : 1))
        .map(c => ({ cards: [c], key: c.v + (c.r ? 0.5 : 0) }));

    return [...comboItems, ...singleItems]
        .sort((a, b) => b.key - a.key)
        .flatMap(item => item.cards);
}

// ── Export for test environments (Node / Vitest) ─────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getPattern, calcSettlement, sortCards };
}

import { getPattern, calcSettlement, sortCards } from '../game-logic.js';

// Helper: build a card object (id is unique per call via counter)
let _id = 0;
const c = (n, v, r) => ({ n, v, r, id: _id++ });

// ─────────────────────────────────────────────────────────────────────────────
// getPattern
// ─────────────────────────────────────────────────────────────────────────────
describe('getPattern', () => {

    describe('invalid inputs', () => {
        test('null returns null', () => expect(getPattern(null)).toBeNull());
        test('empty array returns null', () => expect(getPattern([])).toBeNull());
        test('mixed red + black returns null', () => {
            expect(getPattern([c('帥', 7, true), c('將', 7, false)])).toBeNull();
        });
        test('two different names (not a valid pattern) returns null', () => {
            expect(getPattern([c('帥', 7, true), c('仕', 6, true)])).toBeNull();
        });
        test('incomplete straight (only 帥仕, missing 相) returns null', () => {
            expect(getPattern([c('帥', 7, true), c('仕', 6, true)])).toBeNull();
        });
        test('cross-group mix 帥+俥+瑪 returns null', () => {
            expect(getPattern([c('帥', 7, true), c('俥', 4, true), c('瑪', 3, true)])).toBeNull();
        });
    });

    describe('單張 (single)', () => {
        test('red 帥 (v=7) → pwr = 7.5', () => {
            expect(getPattern([c('帥', 7, true)])).toEqual({ name: '單張', pwr: 7.5 });
        });
        test('black 將 (v=7) → pwr = 7', () => {
            expect(getPattern([c('將', 7, false)])).toEqual({ name: '單張', pwr: 7 });
        });
        test('red 兵 (v=1, lowest) → pwr = 1.5', () => {
            expect(getPattern([c('兵', 1, true)])).toEqual({ name: '單張', pwr: 1.5 });
        });
        test('black 卒 (v=1) → pwr = 1', () => {
            expect(getPattern([c('卒', 1, false)])).toEqual({ name: '單張', pwr: 1 });
        });
    });

    describe('對子 (pair)', () => {
        test('two red 仕 → name=對子, pwr=1000×2+13', () => {
            const result = getPattern([c('仕', 6, true), c('仕', 6, true)]);
            expect(result).toEqual({ name: '對子', pwr: 2013 });
        });
        test('two black 士 → name=對子', () => {
            const result = getPattern([c('士', 6, false), c('士', 6, false)]);
            expect(result.name).toBe('對子');
            expect(result.pwr).toBe(2012); // 1000*2 + 6+6
        });
        test('two 兵 (lowest pair) → name=對子', () => {
            const result = getPattern([c('兵', 1, true), c('兵', 1, true)]);
            expect(result.name).toBe('對子');
            expect(result.pwr).toBe(2003); // 2000 + 1.5+1.5
        });
    });

    describe('同子 (set of 3+)', () => {
        test('three 兵 → name=同子, pwr=3000+4.5', () => {
            const result = getPattern([c('兵', 1, true), c('兵', 1, true), c('兵', 1, true)]);
            expect(result).toEqual({ name: '同子', pwr: 3004.5 });
        });
        test('four same cards → name=同子', () => {
            const result = getPattern([c('兵', 1, true), c('兵', 1, true), c('兵', 1, true), c('兵', 1, true)]);
            expect(result.name).toBe('同子');
            expect(result.pwr).toBe(4006); // 1000*4 + 1.5*4
        });
    });

    describe('順子 (straight)', () => {
        test('red group A [帥仕相]', () => {
            const result = getPattern([c('帥', 7, true), c('仕', 6, true), c('相', 5, true)]);
            expect(result.name).toBe('順子');
            expect(result.pwr).toBe(6000 + 7.5 + 6.5 + 5.5); // 6019.5
        });
        test('red group B [俥瑪砲]', () => {
            const result = getPattern([c('俥', 4, true), c('瑪', 3, true), c('砲', 2, true)]);
            expect(result.name).toBe('順子');
            expect(result.pwr).toBe(6000 + 4.5 + 3.5 + 2.5); // 6010.5
        });
        test('black group A [將士象]', () => {
            const result = getPattern([c('將', 7, false), c('士', 6, false), c('象', 5, false)]);
            expect(result.name).toBe('順子');
            expect(result.pwr).toBe(6000 + 7 + 6 + 5); // 6018
        });
        test('black group B [車馬包]', () => {
            const result = getPattern([c('車', 4, false), c('馬', 3, false), c('包', 2, false)]);
            expect(result.name).toBe('順子');
            expect(result.pwr).toBe(6000 + 4 + 3 + 2); // 6009
        });
        test('order of cards in array does not matter for 順子', () => {
            const r1 = getPattern([c('帥', 7, true), c('仕', 6, true), c('相', 5, true)]);
            const r2 = getPattern([c('相', 5, true), c('帥', 7, true), c('仕', 6, true)]);
            expect(r1.name).toBe('順子');
            expect(r2.name).toBe('順子');
            expect(r1.pwr).toBe(r2.pwr);
        });
    });

    describe('power ordering', () => {
        test('順子 beats 同子 beats 對子 beats 單張', () => {
            const single = getPattern([c('帥', 7, true)]);
            const pair   = getPattern([c('帥', 7, true), c('帥', 7, true)]);
            const set    = getPattern([c('兵', 1, true), c('兵', 1, true), c('兵', 1, true)]);
            const str    = getPattern([c('帥', 7, true), c('仕', 6, true), c('相', 5, true)]);
            expect(str.pwr).toBeGreaterThan(set.pwr);
            expect(set.pwr).toBeGreaterThan(pair.pwr);
            expect(pair.pwr).toBeGreaterThan(single.pwr);
        });
        test('red card beats black card of same value in 單張', () => {
            const red   = getPattern([c('仕', 6, true)]);
            const black = getPattern([c('士', 6, false)]);
            expect(red.pwr).toBeGreaterThan(black.pwr);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcSettlement
// ─────────────────────────────────────────────────────────────────────────────
describe('calcSettlement', () => {

    test('diffs always sum to zero', () => {
        const cases = [
            [[3, 2, 2, 1], 0],
            [[5, 3, 0, 0], 0],
            [[8, 0, 0, 0], 0],
            [[2, 2, 2, 2], 1],
        ];
        for (const [tricks, winner] of cases) {
            const diffs = calcSettlement(tricks, winner);
            expect(diffs.reduce((a, b) => a + b, 0)).toBe(0);
        }
    });

    test('equal 2 tricks each, lastWinner=0', () => {
        const diffs = calcSettlement([2, 2, 2, 2], 0);
        expect(diffs[1]).toBe(-60); // (2-5)*20
        expect(diffs[2]).toBe(-60);
        expect(diffs[3]).toBe(-60);
        expect(diffs[0]).toBe(180); // wins what others lost
    });

    test('5-3-0-0 split, lastWinner=0', () => {
        const diffs = calcSettlement([5, 3, 0, 0], 0);
        expect(diffs[1]).toBe(-40);  // (3-5)*20
        expect(diffs[2]).toBe(-100); // (0-5)*20
        expect(diffs[3]).toBe(-100);
        expect(diffs[0]).toBe(240);
    });

    test('8-trick sweep doubles all amounts', () => {
        const diffs = calcSettlement([8, 0, 0, 0], 0);
        expect(diffs[1]).toBe(-200); // (0-5)*20*2
        expect(diffs[2]).toBe(-200);
        expect(diffs[3]).toBe(-200);
        expect(diffs[0]).toBe(600);
    });

    test('non-sweeper getting 7 tricks does NOT double', () => {
        const diffs = calcSettlement([7, 1, 0, 0], 0);
        expect(diffs[1]).toBe(-80); // (1-5)*20*1
    });

    test('lastWinner at index 3', () => {
        const diffs = calcSettlement([2, 2, 2, 2], 3);
        expect(diffs[0]).toBe(-60);
        expect(diffs[1]).toBe(-60);
        expect(diffs[2]).toBe(-60);
        expect(diffs[3]).toBe(180);
    });

    test('player with exactly 5 tricks breaks even', () => {
        const diffs = calcSettlement([5, 3, 0, 0], 0);
        // player 0 has 5 tricks but is lastWinner — they absorb others' losses
        // player 1 has 3 tricks, non-winner
        expect(diffs[1]).toBe(-40);
    });

    test('sweep: player 3 takes all 8, others at 0', () => {
        const diffs = calcSettlement([0, 0, 0, 8], 3);
        expect(diffs[0]).toBe(-200);
        expect(diffs[1]).toBe(-200);
        expect(diffs[2]).toBe(-200);
        expect(diffs[3]).toBe(600);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// sortCards
// ─────────────────────────────────────────────────────────────────────────────
describe('sortCards', () => {

    test('returns an array', () => {
        expect(Array.isArray(sortCards([c('兵', 1, true)]))).toBe(true);
    });

    test('empty hand returns empty array', () => {
        expect(sortCards([])).toEqual([]);
    });

    test('does not mutate the input array', () => {
        const hand = [c('兵', 1, true), c('帥', 7, true)];
        const before = hand.map(x => x.id);
        sortCards(hand);
        expect(hand.map(x => x.id)).toEqual(before);
    });

    test('higher value singles sorted before lower', () => {
        const hand = [c('兵', 1, true), c('帥', 7, true), c('砲', 2, true)];
        const sorted = sortCards(hand);
        expect(sorted[0].n).toBe('帥');
        expect(sorted[1].n).toBe('砲');
        expect(sorted[2].n).toBe('兵');
    });

    test('red beats black at same value in tie-break', () => {
        const hand = [c('士', 6, false), c('仕', 6, true)];
        const sorted = sortCards(hand);
        expect(sorted[0].r).toBe(true); // red comes first
    });

    test('complete red 順子 group A is grouped together and placed first', () => {
        const hand = [
            c('兵', 1, true),
            c('相', 5, true),
            c('仕', 6, true),
            c('帥', 7, true),
        ];
        const sorted = sortCards(hand);
        const first3 = sorted.slice(0, 3).map(x => x.n).sort();
        expect(first3).toEqual(['仕', '帥', '相'].sort());
        expect(sorted[3].n).toBe('兵');
    });

    test('complete red 順子 group B is grouped and placed before singles', () => {
        const hand = [
            c('兵', 1, true),
            c('砲', 2, true),
            c('瑪', 3, true),
            c('俥', 4, true),
        ];
        const sorted = sortCards(hand);
        const first3 = sorted.slice(0, 3).map(x => x.n).sort();
        expect(first3).toEqual(['俥', '瑪', '砲'].sort());
        expect(sorted[3].n).toBe('兵');
    });

    test('single card hand returns that card', () => {
        const card = c('帥', 7, true);
        const sorted = sortCards([card]);
        expect(sorted).toHaveLength(1);
        expect(sorted[0].n).toBe('帥');
    });
});

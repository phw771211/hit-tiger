# UI Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 5 low-effort visual improvements to `index.html` that significantly elevate the game's UI quality.

**Architecture:** All changes are pure CSS edits inside the existing `<style>` block in `index.html`. No new files. No JS changes. No structural HTML changes.

**Tech Stack:** Vanilla HTML/CSS, Google Fonts CDN (Noto Serif SC)

---

## Task 1: Add Noto Serif SC font

**Files:**
- Modify: `index.html` (lines 3–6, inside `<head>`)

- [ ] **Step 1: Add Google Fonts link tag**

Insert after the `<meta viewport>` tag (line 5), before `<title>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Update font-family in body rule**

Find in `<style>`:
```css
body { background: #1a1a1a; color: white; font-family: sans-serif; ...
```
Change to:
```css
body { background: #1a1a1a; color: white; font-family: 'Noto Serif SC', serif; ...
```

- [ ] **Step 3: Visual check**

Open `index.html` in browser. Lobby title "象棋吃墩 PVP" should render in a serif stroke font. Cards in hand (once game starts) should use the same font.

---

## Task 2: Table vignette background

**Files:**
- Modify: `index.html` (`.table` CSS rule, around line 16)

- [ ] **Step 1: Replace flat green with radial gradient**

Find:
```css
.table { width: 700px; height: 700px; background: var(--table); border: 12px solid #5d4037; border-radius: 24px; position: relative; box-shadow: inset 0 0 100px #000; display: none; }
```
Change `background: var(--table)` to:
```css
background: radial-gradient(ellipse at center, #2e7d32 45%, #1b4d20 100%);
```
Full updated rule:
```css
.table { width: 700px; height: 700px; background: radial-gradient(ellipse at center, #2e7d32 45%, #1b4d20 100%); border: 12px solid #5d4037; border-radius: 24px; position: relative; box-shadow: inset 0 0 100px #000; display: none; }
```

- [ ] **Step 2: Visual check**

Start a game. The table should be brighter green in the center fading to dark green at the edges.

---

## Task 3: Card inner-border frame

**Files:**
- Modify: `index.html` (`.card` CSS rule, around line 28)

- [ ] **Step 1: Add inset box-shadow to .card**

Find:
```css
.card { width: 40px; height: 60px; background: white; color: black; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; border: 2px solid #333; cursor: pointer; transition: transform 0.2s; flex-shrink: 0; }
```
Add `box-shadow: inset 0 0 0 2px rgba(0,0,0,0.12);` to the rule:
```css
.card { width: 40px; height: 60px; background: white; color: black; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; border: 2px solid #333; cursor: pointer; transition: transform 0.2s; flex-shrink: 0; box-shadow: inset 0 0 0 2px rgba(0,0,0,0.12); }
```

- [ ] **Step 2: Visual check**

Cards in hand should show a subtle inner shadow that gives them a recessed frame look.

---

## Task 4: Card back diagonal stripe pattern

**Files:**
- Modify: `index.html` (`.card.back` CSS rule, around line 32)

- [ ] **Step 1: Replace solid color back with stripe pattern**

Find:
```css
.card.back { background: var(--card-back) !important; color: transparent !important; border-color: #fff; }
```
Replace with:
```css
.card.back { background-color: #2c3e50 !important; background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 8px) !important; color: transparent !important; border-color: #7f8c8d; }
```

- [ ] **Step 2: Visual check**

Opponents' face-down cards should show a subtle diagonal stripe pattern on the dark background.

---

## Task 5: Smooth active-glow transition

**Files:**
- Modify: `index.html` (`.active-glow` and `.player` CSS rules, around lines 17 and 26)

- [ ] **Step 1: Add transition to .player**

Find:
```css
.player { position: absolute; text-align: center; width: 360px; z-index: 10; padding: 10px; border-radius: 15px; }
```
Add `transition: background 0.3s, box-shadow 0.3s;`:
```css
.player { position: absolute; text-align: center; width: 360px; z-index: 10; padding: 10px; border-radius: 15px; transition: background 0.3s, box-shadow 0.3s; }
```

- [ ] **Step 2: Visual check**

During a game, when the turn changes, the gold glow should fade in and out smoothly rather than snapping instantly.

---

## Final: Syntax Pre-check

- [ ] **Run syntax check before pushing**

On macOS/Linux:
```bash
node --input-type=module < <(sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d')
```
Expected: no output.

- [ ] **Run regression checklist**

Open `docs/REGRESSION.md` and complete at minimum:
- Section 1 (Lobby)
- Section 2 (Game Start)
- Section 3 (Card Selection)
- Section V (Visual Regression)

# Regression Checklist — 象棋吃墩 PVP

> Run this checklist **before every push to GitHub**. Check off each item manually in two browser tabs (Tab A = host, Tab B = guest). Reference `FUNCTIONS.md` for expected behaviour of each function.

---

## How to Run

1. Open `index.html` directly in Chrome (file:// is fine for single-file testing)
2. Open a second tab for the guest
3. Work through each section below
4. **Do not push if any ❌ item is unresolved**

### Syntax Pre-check (automated, 30 seconds)
Run this before opening the browser:
```bash
node --input-type=module < <(sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d')
```
Expected: no output (no syntax errors). Any error = stop, fix before continuing.

> Windows PowerShell alternative:
> ```powershell
> $js = (Get-Content index.html -Raw) -replace '(?s)^.*<script>','' -replace '</script>.*$',''
> node --input-type=module -e $js 2>&1
> ```

---

## Section 1 — Lobby

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 1.1 | Open `index.html` (no URL params) | Lobby shows, "創建房間" visible, "加入遊戲" hidden | |
| 1.2 | Open `index.html?room=FAKEID` | "加入遊戲" visible, "創建房間" hidden | |
| 1.3 | Enter nick and click "創建房間" | Lobby switches to status view; room URL appears in the copy input | |
| 1.4 | Copy URL, open in Tab B, enter nick, click "加入遊戲" | Tab A player list updates; count shows (2/4) | |
| 1.5 | With 4 players present | "擲骰決定首家" button appears in Tab A (host only) | |
| 1.6 | Nick saved in localStorage | Refresh Tab A; previous nick pre-filled | |

## Section 2 — Game Start

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 2.1 | Host clicks "擲骰決定首家" | Toast shows first player name; game table appears on all tabs | |
| 2.2 | Game table visible | Each player's hand shows face-down backs for opponents, own cards face-up | |
| 2.3 | Chat panel visible | Chat appears on right (desktop) or bottom (mobile) after game starts | |
| 2.4 | Music toggle button visible | ♪ button appears top-left after first click anywhere | |

## Section 3 — Card Selection & Play

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 3.1 | Click card when it's your turn | Card lifts (translateY -18px), gold border | |
| 3.2 | Click selected card again | Card deselects, returns to normal | |
| 3.3 | Select invalid pattern, click "確認叫牌" | Toast "❌ 無效牌型"; no card submitted | |
| 3.4 | Select valid single card, click "確認叫牌" | Button disables; back-card appears in center slot | |
| 3.5 | Select wrong count when following | Toast "❌ 需出N張" | |
| 3.6 | Select correct count when following | Confirm button enabled | |

## Section 4 — Battle Animation

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 4.1 | All 4 players confirm | Cards revealed one-by-one starting from caller | |
| 4.2 | Non-beating plays | Shown face-down (grey) in slot | |
| 4.3 | Winning play | Shown face-up with correct colour (red/black) | |
| 4.4 | After animation completes | Slots clear; trick badge added to winner; next turn begins | |
| 4.5 | Trick badge colours | Red pieces = red border/text; Black pieces = black | |

## Section 5 — Timer

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 5.1 | First call made | Timer appears top-right, counts down from 30 | |
| 5.2 | Timer reaches 0 | Non-confirmed players auto-play; battle proceeds | |
| 5.3 | All confirm before timeout | Timer stops and disappears | |

## Section 6 — Settlement

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 6.1 | Round ends (8 tricks played) | Settlement overlay appears on all tabs | |
| 6.2 | Score diffs | Positive = green, negative = red; based on 5-trick baseline × 20 | |
| 6.3 | Winner sees | "由您擲骰決定下一局" gold button | |
| 6.4 | Non-winners see | Waiting text naming the winner | |
| 6.5 | All-8-tricks sweep | All amounts doubled | |
| 6.6 | Winner clicks roll | Toast shows new first player; new round deals | |

## Section 7 — Statistics Overlay

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 7.1 | Click "輸贏統計" | Overlay opens with table of all 4 players | |
| 7.2 | Net column | Green for positive, red for negative, grey for zero | |
| 7.3 | After buy-in approved | Balances and net reflect the new amount | |

## Section 8 — Buy-In (帶入籌碼)

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 8.1 | Guest clicks "帶入籌碼", enters amount | Toast confirms request sent; button blocked until resolved | |
| 8.2 | Host sees notification dot | Red dot on "房間管理" button | |
| 8.3 | Host opens room mgmt → fund requests | Guest's request shown with Approve/Reject | |
| 8.4 | Host approves | All tabs show toast; guest balance increases | |
| 8.5 | Host rejects | Guest sees rejection toast; pending flag clears | |
| 8.6 | Host clicks "帶入籌碼" | Amount applied immediately, no request flow | |

## Section 9 — Chat

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 9.1 | Type message, press Enter | Message appears in chat on both tabs | |
| 9.2 | HTML characters in message | Rendered as escaped text (no XSS) | |
| 9.3 | Chat history > 50 messages | Oldest message dropped; no crash | |

## Section 10 — Reconnection

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 10.1 | Guest closes and reopens tab during game | Auto-rejoin attempted; "已重新連線" toast appears | |
| 10.2 | Guest disconnects mid-turn | Toast notifies "自動代打中"; game continues | |
| 10.3 | Rejoin after 10+ seconds fails | Lobby shown with warning toast | |

## Section 11 — Audio

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 11.1 | First click on page | Background music starts; ♪ button appears | |
| 11.2 | Click any button or card | Short click sound plays | |
| 11.3 | Click ♪ button | Music fades out; button shows strikethrough ♪ | |
| 11.4 | Click ♪ again | Music fades back in | |

## Section 12 — Mobile Layout (resize browser to 375px width)

| # | Action | Expected Result | Pass? |
|---|---|---|---|
| 12.1 | Table visible | Table scales down to fit viewport | |
| 12.2 | Chat panel | Appears as bottom sheet, not right sidebar | |
| 12.3 | Bottom buttons | Shift up above chat panel, not overlapping | |
| 12.4 | Main action button | Visible above chat | |

---

## Visual Regression Checklist (UI-specific)

Run this after any CSS change:

| # | Element | Expected Appearance |
|---|---|---|
| V.1 | Game table | Dark green with vignette (darker at edges) |
| V.2 | Card faces | White background, inner shadow frame, serif font for character |
| V.3 | Card backs | Dark background with diagonal stripe pattern |
| V.4 | Active player area | Gold glow fades in smoothly (not instant snap) |
| V.5 | Lobby panel | Gold border on dark blue background |
| V.6 | Settlement overlay | Readable on all screen sizes |
| V.7 | Trick badges | Readable against green table background |

---

## Known Limitations / Out of Scope

- No automated test framework (single-file HTML game, no build system)
- P2P connectivity depends on PeerJS relay server availability
- 3+ player testing requires 3+ devices or browser profiles

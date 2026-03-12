# 象棋吃墩 PVP — Function Reference

> This document is the **regression baseline**. Update it whenever functions are added, removed, or their behaviour changes.

---

## Global Constants & State

### `CHESS_DATA` (Array, 32 cards)
Static deck definition. Each entry: `{ n: string, v: number, r: boolean }`.
- `n` = piece name (Chinese character)
- `v` = value (1–7)
- `r` = true for Red side, false for Black side

Red pieces: 帥(7) 仕(6)×2 相(5)×2 俥(4)×2 瑪(3)×2 砲(2)×2 兵(1)×5
Black pieces: 將(7) 士(6)×2 象(5)×2 車(4)×2 馬(3)×2 包(2)×2 卒(1)×5

### Game State Variables
| Variable | Type | Description |
|---|---|---|
| `peer` | Peer | PeerJS instance for this client |
| `connections` | Array[Peer.DataConnection] | Host-only: connections to guests [0]=guest1, [1]=guest2, [2]=guest3 |
| `hostConn` | Peer.DataConnection | Guest-only: connection to host |
| `isHost` | boolean | Whether this client is the room host |
| `myIndex` | number | This player's seat index (0–3) |
| `names` | string[4] | Player nicknames by seat index |
| `playerPeerIds` | string[4] | PeerJS IDs by seat index |
| `balances` | number[4] | Current chip balances |
| `buyIns` | number[4] | Total buy-in amounts (for net P&L) |
| `hands` | Card[][4] | Each player's current hand |
| `trickHistory` | Card[][4] | All cards won as tricks per player |
| `selectedIDs` | any[] | IDs of cards currently selected by local player |
| `confirmedIDs` | any[] | IDs of cards that were confirmed this trick |
| `confirmedCounts` | number[4] | How many cards each player confirmed this trick |
| `hasConfirmed` | boolean[4] | Whether each player has submitted cards this trick |
| `tableCards` | Card[][4] | Cards played to the center this trick |
| `currentCall` | object\|null | Active call: `{ name, count, pwr, callerIdx }` |
| `state` | string | Local UI state: `"IDLE"` \| `"MY_TURN"` \| `"FOLLOWING"` \| `"WAITING"` \| `"ANIMATING"` |
| `turn` | number | Seat index of the player whose turn it is to lead |
| `roundWinners` | object[] | `{ winner: number, tricks: number }` records per trick |
| `currentSettleWinnerIdx` | number | Seat index of last round winner (for next-game authority) |
| `fundRequests` | object[] | Host-only: pending buy-in requests |
| `hasPendingRequest` | boolean | Guest-only: whether a buy-in request is pending |
| `disconnected` | boolean[4] | Whether each player is currently disconnected |
| `reconnectTimer` | interval | Guest reconnect polling interval |
| `isProcessing` | boolean | Guard against double-click on lobby buttons |
| `timerInterval` | interval | Host-only: 30-second per-trick countdown |
| `chatMessages` | object[] | Last 50 chat messages (name + text) |
| `audioCtx` | AudioContext | Web Audio context (lazy-init on first click) |
| `bgGain` | GainNode | Master gain for background music |
| `bgScheduler` | timeout | Timeout handle for next chord scheduling |
| `bgChordIdx` | number | Index into `LOFI_CHORDS` cycle |
| `musicMuted` | boolean | Whether background music is muted |
| `audioReady` | boolean | Whether audio has been initialised |

---

## Networking & Lobby

### `createRoom()`
Host flow. Creates a PeerJS peer, registers `connection` listener for incoming guests. On guest `JOIN` assigns seat index and calls `updateLobbyNames()`. Saves nick to localStorage.

### `joinRoomAction()`
Guest flow. Creates PeerJS peer, connects to host using room ID from URL param `?room=`. Sends `JOIN` message with nickname. Registers `handleData` on host connection.

### `handleData(data, senderIdx)`
Central message dispatcher. Handles all incoming PeerJS message types:

| Message type | Handler behaviour |
|---|---|
| `LOBBY_SYNC` | Update player list and count in lobby UI |
| `INIT` | Set `myIndex`, hide lobby, show table, call `render()` |
| `FULL_STATE` | Full game state restore on rejoin; set all state vars, render |
| `SYNC` | Update turn/call/confirmed state; toggle timer display |
| `DISTRIBUTE` | Reset round state, set new hands, sort hand, render |
| `CONFIRM_OK` | Mark player as confirmed; show back-cards in slot; render |
| `FORCE_BATTLE` | Strip played cards from hands, record trick winner, run animation |
| `SETTLE_ALL` | Apply balance diffs, show settlement overlay |
| `TIMER` | Update countdown display |
| `MSG` | Show toast notification |
| `CHAT` | Append message; host relays to all other guests |
| `FUND_REQUEST` | Host: queue buy-in request, update dot indicator |
| `FUND_APPROVED` | Add amount to balance and buyIn; clear pending flag |
| `FUND_REJECTED` | Clear pending flag, show rejection toast |
| `PLAY_ACTION` | Host: forward to `serverReceiveAction()` |
| `REQ_NEXT_ROLL` | Host: roll dice for next-round start order |

### `broadcast(data)`
- If host: sends to all guests via `connections`, then calls `handleData` locally.
- If guest: sends to host via `hostConn`.

### `updateLobbyNames()`
Refreshes lobby player list UI. Shows "roll dice" button when 4 players present. Broadcasts `LOBBY_SYNC` to all peers.

### `hostRollDice()`
Host-only. Randomly picks first player (0–3). Broadcasts `INIT` to all (with individual seat indexes), then calls `serverStartRound()` after 1.5 s.

---

## Server (Host-Only) Game Logic

### `serverStartRound(forcedStart?)`
Shuffles deck, deals 8 cards to each player starting from `forcedStart`. Broadcasts `DISTRIBUTE`. Resets `roundWinners` and `turn`.

### `serverSyncLocal()`
Broadcasts `SYNC` with current `turn`, `currentCall`, `hasConfirmed`.

### `serverReceiveAction(idx, cards)`
Called when a player plays cards (host handles own play too).
1. Stores cards in `tableCards[idx]`, marks `hasConfirmed[idx]`.
2. Broadcasts `CONFIRM_OK`.
3. If this is the opening call: sets `currentCall`, starts 30-second timer, triggers auto-play for disconnected players.
4. If all 4 players confirmed: stops timer, calls `serverProcessBattle()`.

### `startTimerHost()`
30-second countdown. Broadcasts `TIMER` each second. On expiry: auto-plays lowest cards for any non-confirmed players.

### `serverProcessBattle()`
Determines trick winner: caller wins by default; any player who plays the same count + same pattern name with higher `pwr` takes over. Records in `roundWinners`. Broadcasts `FORCE_BATTLE`. After 4 s, either ends round or sets next turn.

### `serverFinalSettle(lastWinnerIdx)`
Tallies tricks per player. Calculates score diffs relative to 5-trick baseline at 20/trick. Doubles all amounts if any player takes all 8 tricks. Updates `balances`. Broadcasts `SETTLE_ALL`.

---

## Client Game Logic

### `getPattern(cards)` → `{ name, pwr } | null`
Validates and classifies a set of cards. Returns null if invalid (mixed colours or unrecognised pattern).

| Pattern | Condition | Power formula |
|---|---|---|
| 單張 (Single) | 1 card | `vSum` (value + 0.5 if red) |
| 對子 (Pair) | 2+ cards, all same name | `1000 × len + vSum` |
| 同子 (Set) | 3+ cards, all same name | `1000 × len + vSum` |
| 順子 (Straight) | 3 cards from [帥仕相] or [俥瑪砲] (red) / [將士象] or [車馬包] (black) | `2000 × len + vSum` |

### `sortHand()`
Sorts `hands[myIndex]` in-place. Priority: combo groups (straights) before singles. Within combos: sorted by descending value. Combos sorted by anchor value descending.

### `flow()`
Called when player clicks the main action button. Validates selection count/type against state and `currentCall`, then broadcasts `PLAY_ACTION`.

### `render()`
Full UI repaint. For each of the 4 display positions (relative to `myIndex`):
- Updates name, balance, status text
- Toggles `active-glow` on the current turn's player area
- Renders own hand as interactive card elements with selection state
- Renders opponents' hands as face-down card backs (minus confirmed count)
- Renders trick history badges

### `runBattleAnimation(winIdx, callerIdx)` (async)
Reveals each player's played cards one by one (starting from caller, clockwise). Non-beating plays are shown face-down. Waits 1.5 s after last reveal, then clears slots and re-renders.

### `resetRoundState()`
Clears `trickHistory`, `selectedIDs`, `confirmedIDs`, `currentCall`, `tableCards`, `hasConfirmed`, `confirmedCounts`. Hides toast.

---

## Reconnection

### `scheduleReconnect()`
Guest-only. Shows persistent toast. Reads rejoin data from localStorage. Polls every 3 s with a new PeerJS connection attempt. On success: sends `REJOIN`, re-registers data/close handlers.

### `autoRejoin(rejoinData)`
Guest-only. Called on `window.onload` if rejoin data exists in localStorage. Attempts immediate reconnect. Falls back to lobby after 10 s.

### `handleRejoin(conn, d)`
Host-only. Restores a guest's connection at their previous seat index. Sends `FULL_STATE`. Broadcasts reconnect notification.

### `fallbackToLobby()`
Resets `isProcessing`, shows nickname form, hides lobby-status, shows warning toast.

---

## Financial / Buy-In Management

### `openFundInput()`
Shows the buy-in amount entry overlay. Blocked if a request is already pending.

### `submitFundRequest()`
Validates amount. Host: calls `processFundApproval()` directly. Guest: sends `FUND_REQUEST` to host, sets `hasPendingRequest`.

### `openFundReqList()`
Host-only. Renders pending fund requests with approve/reject buttons in overlay.

### `approveFund(i)`
Host: removes request at index `i`, calls `processFundApproval()`, refreshes list.

### `rejectFund(i)`
Host: removes request, sends `FUND_REJECTED` to affected guest, refreshes list.

### `processFundApproval(playerIdx, name, amount)`
Broadcasts `FUND_APPROVED` to all players.

### `updateFundDots()`
Shows/hides the red notification dot on the room management button based on pending request count.

---

## Statistics

### `openStats()`
Renders the stats overlay table: player name, total buy-in, current balance, net P&L (colour-coded).

---

## Chat

### `showChatPanel()`
Makes `#chat-wrap` visible (called on game start/rejoin).

### `sendChat()`
Reads input, escapes HTML, appends locally if host, sends to host/all via `broadcast`.

### `appendChatMsg(name, text)`
Appends a message div to `#chat-msgs`. Trims history to 50 messages. Auto-scrolls.

### `escapeHtml(s)`
Sanitises strings before inserting into innerHTML. Escapes `&`, `<`, `>`, `"`.

---

## Settlement

### `showSettle(diffs, counts, lastWinner, winnerIdx)`
Renders settlement overlay with trick counts and P&L per player. Winner sees a "roll for next game" button; others see a waiting message.

### `requestNextGame()`
Winner-only. Broadcasts `REQ_NEXT_ROLL` to trigger host dice roll for next round order.

---

## Audio

### `initAudio()`
Lazy-initialised on first user click. Creates `AudioContext`, master gain node, starts background music, shows music toggle button.

### `startBgMusic()`
Clears existing scheduler and begins chord cycle.

### `scheduleChord()`
Synthesises one 2-second lofi chord (bass sine + triangle tones through low-pass filter) using Web Audio API. Schedules the next chord 1.95 s later. Cycles through `LOFI_CHORDS` (Cmaj7 → Am7 → Fmaj7 → G7).

### `toggleMusic()`
Fades background gain to 0 or 0.12 over 0.1 s. Toggles strikethrough on the ♪ button.

### `playClick()`
Plays a short 700→350 Hz sine tone on any button or card click.

---

## Notifications

### `showToast(message)`
Displays `#toast` with message. Auto-hides after 2.5 s unless `currentCall` is active.

### `showPersistentToast(message)`
Displays `#toast` without auto-hide (used for "current call" announcements).

### `hideToast()`
Immediately hides `#toast`.

---

## Lifecycle

### `window.onload`
Restores nickname from localStorage. If URL has `?room=`, switches lobby to join mode. If rejoin data exists for this room, calls `autoRejoin()`.

### Audio click listeners (two `document.addEventListener('click', ...)`)
1. First click anywhere: calls `initAudio()` once, then removes itself.
2. All subsequent clicks on buttons or cards: calls `playClick()`.

---

## Network Message Types (Full Reference)

| Type | Direction | Payload fields |
|---|---|---|
| `JOIN` | guest→host | `name` |
| `REJOIN` | guest→host | `name`, `prevIndex` |
| `PLAY_ACTION` | guest→host | `cards` |
| `REQ_NEXT_ROLL` | guest→host | `winnerIdx` |
| `FUND_REQUEST` | guest→host | `playerIdx`, `name`, `amount` |
| `CHAT` | any→host | `name`, `text` |
| `LOBBY_SYNC` | host→all | `names`, `count` |
| `INIT` | host→guest | `index` |
| `FULL_STATE` | host→rejoin | `index`, `hands`, `balances`, `turn`, `currentCall`, `hasConfirmed`, `tableCards`, `trickHistory`, `names`, `roundWinners` |
| `SYNC` | host→all | `turn`, `currentCall`, `hasConfirmed` |
| `DISTRIBUTE` | host→all | `hands` |
| `CONFIRM_OK` | host→all | `idx`, `cardCount` |
| `FORCE_BATTLE` | host→all | `tableCards`, `winIdx`, `callerIdx`, `wonCards` |
| `SETTLE_ALL` | host→all | `balances`, `diffs`, `counts`, `lastWinner`, `winnerIdx` |
| `TIMER` | host→all | `time` |
| `MSG` | host→all | `msg` |
| `FUND_APPROVED` | host→all | `playerIdx`, `name`, `amount` |
| `FUND_REJECTED` | host→guest | `amount` |

# Departure Ledger — Design Spec

## Goal

All players who ever sat at a table appear in the W/L stats view, including those who left mid-session. The sum of all nets always zeros out so players can screenshot the view and settle real-money debts.

## Background

Currently `openStats()` shows only the 4 active seats. When a player leaves and a new one fills their seat, the leaver's net is lost. Additionally, if a returning player's original seat has been taken, `handleRejoin` does not handle the conflict — it would silently overwrite the new occupant.

## Architecture

### New State

```js
let departureLedger = []; // [{name, net, balance, buyIn, seatIdx}]
```

- **Host-authoritative.** Synced to all clients via `SEAT_FILLED` broadcast and `FULL_STATE`.
- `net` — for display in the stats view.
- `balance` + `buyIn` — for restoring a returning player who takes a different seat.
- `seatIdx` — used to match a REJOIN `prevIndex` to the correct ledger entry.

### When the Ledger Grows

Only when a **new player physically fills a vacant seat** (SEAT_FILLED fires). At that moment:

1. Push departed player's record to `departureLedger` (before `buyIns[idx]` is reset).
2. Reset `buyIns[idx] = balances[idx]` for the new player (existing behaviour).
3. Include `departureLedger` in the `SEAT_FILLED` broadcast.

Vacant seats whose occupants have **not yet been replaced** remain live in the 4-seat arrays (`names[i]`, `balances[i]`, `buyIns[i]`). They are not in the ledger. This prevents double-counting in the stats view.

### REJOIN Conflict Resolution

Three cases when the host receives a `REJOIN` message:

| Condition | Action |
|---|---|
| `vacant[prevIndex] === true` | Normal rejoin to original seat. No ledger change. |
| Seat taken, another vacant seat exists | Record displaced player to ledger. Restore returning player from ledger entry. Broadcast `SEAT_FILLED` for new seat. |
| Seat taken, no other vacant seat | Send MSG `'目前沒有空位，無法加入'`. No state change. |

**Normal rejoin flow (`vacant[prevIndex] === true`):**
After restoring the player to their original seat, broadcast `{ type: 'SEAT_FILLED', idx: prevIndex, name: d.name, buyIn: buyIns[prevIndex], ledger: departureLedger }` so all other clients flip `vacant[prevIndex]` back to `false` and update their displayed state. (Currently `handleRejoin` only sends a `MSG` broadcast, leaving other clients with a stale `vacant` flag.)

**Restore flow (seat taken, vacant seat found):**
1. Find the returning player's ledger entry: `departureLedger.find(e => e.seatIdx === prevIndex)`
2. Record the currently-vacant seat's player to ledger: `{name: names[vacantSeat], net: balances[vacantSeat] - buyIns[vacantSeat], balance: balances[vacantSeat], buyIn: buyIns[vacantSeat], seatIdx: vacantSeat}`
3. Restore: `names[vacantSeat] = d.name`, `balances[vacantSeat] = entry.balance`, `buyIns[vacantSeat] = entry.buyIn`
4. Remove returning player from ledger.
5. Set `vacant[vacantSeat] = false`, `disconnected[vacantSeat] = false`.
6. Wire `close`/`error` handlers to `handleGuestDisconnect(vacantSeat)`.
7. Send `FULL_STATE` (with ledger) to returning player.
8. Broadcast `SEAT_FILLED` (with updated ledger and `buyIn: entry.buyIn`) for the new seat.

### Stats View (`openStats`)

Show three groups (no visual separator needed):

1. **Active seats** (seats where `!vacant[i]`) — name, buyIn, balance, net
2. **Still-vacant seats** (seats where `vacant[i]`) — name, buyIn, balance, net drawn live from the 4-seat arrays
3. **Ledger entries** (`departureLedger`) — name, net (balance and buyIn not shown, only net)

For groups 1 and 2 the net is `balances[i] - buyIns[i]`. For group 3 the net is `entry.net`.

**Zero-sum guarantee:** Total chips in the system are conserved (settlement is zero-sum). Every chip belongs to exactly one source — either a seat array or a ledger entry, never both. Therefore the sum of all nets is always 0.

### Sync Points

`departureLedger` is included in:

- `SEAT_FILLED` broadcast — fires in three cases: normal new-player fill, rejoin-conflict reassignment, and normal rejoin to original seat (new). Payload includes `{ idx, name, buyIn, ledger }`. Client handler: `buyIns[data.idx] = data.buyIn; departureLedger = data.ledger;` — using the broadcast `buyIn` instead of always resetting to `balances[idx]`, so restored players keep their correct buyIn baseline.
- `FULL_STATE` send/receive — so newly-joining and rejoining players receive full history.

No new message types are needed.

### Stats Table Display

The existing stats table has columns: 玩家, 總買入, 當前餘額, 淨輸贏.

- **Groups 1 & 2 (seat rows):** all four columns populated normally.
- **Group 3 (ledger rows):** 總買入 and 當前餘額 show `—`; 淨輸贏 shows `entry.net`. A subtle style difference (e.g. slightly dimmed text or an italicised name) helps distinguish departed players visually.

## Files Modified

- `index.html` only — new state variable, updated `openStats()`, updated host JOIN handler (SEAT_FILLED recording), updated `handleRejoin`, updated `SEAT_FILLED` client handler, updated `FULL_STATE` send/receive.
- `game-logic.js` — no changes.
- `tests/game-logic.test.js` — no changes.

## Edge Cases

1. **Returning player's name matches a ledger entry but `seatIdx` differs** — impossible in practice (a player can only leave once per session from one seat), but lookup is by `seatIdx` to be safe.
2. **Two players both try to rejoin simultaneously** — PeerJS processes connections serially on the host; first one in wins the vacant seat, second gets rejection.
3. **Host leaves** — not possible via UI (leave button hidden for `myIndex === 0`). Existing behaviour unchanged.
4. **Ledger entry balance goes stale** — impossible. Once a player's entry is in the ledger, the new occupant's play does not affect `entry.balance` (it's a snapshot value stored in the JS object, not a reference to `balances[i]`).

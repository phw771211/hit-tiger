# Departure Ledger Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every player who ever sat at the table in the W/L stats view so real-money settlement is always complete and sums to zero.

**Architecture:** A `departureLedger` array accumulates entries when a new player physically replaces a vacant seat. Vacant seats whose occupants haven't yet been replaced remain live in the 4-seat arrays, so there is never double-counting. `openStats()` shows all 4 seat rows plus any ledger entries. `handleRejoin` gains a conflict-resolution path: if the original seat is taken, the returning player is restored to any other vacant seat using the ledger entry. All state is synced to clients via `SEAT_FILLED` and `FULL_STATE` messages.

**Tech Stack:** Vanilla JS, PeerJS — single file `index.html`

---

## Files Modified
- `index.html` — all changes (new state, updated host JOIN handler, updated client SEAT_FILLED handler, updated FULL_STATE send/receive, rewritten `handleRejoin`, rewritten `openStats`)
- `game-logic.js` — no changes
- `tests/game-logic.test.js` — no changes

---

## Task 1: Add `departureLedger` state variable

**Files:**
- Modify: `index.html` (state block ~line 284)

- [ ] **Step 1: Add state variable**

Find line 284:
```js
let vacant = [false, false, false, false];
```
Add immediately after it:
```js
let departureLedger = []; // [{name, net, balance, buyIn, seatIdx}]
```

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: 38 passed

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add departureLedger state variable"
```

---

## Task 2: Host records departure + updates SEAT_FILLED and FULL_STATE sends

**Files:**
- Modify: `index.html` (createRoom mid-game join block ~lines 338–346)

The mid-game join block currently looks like this (lines 338–349):
```js
if (vacantIdx !== -1) {
    connections[vacantIdx - 1] = conn;
    names[vacantIdx] = d.name;
    vacant[vacantIdx] = false;
    disconnected[vacantIdx] = false;
    conn.on('close', () => handleGuestDisconnect(vacantIdx));
    conn.on('error', () => handleGuestDisconnect(vacantIdx));
    conn.send({ type: 'FULL_STATE', index: vacantIdx, hands, balances, turn, currentCall, hasConfirmed, tableCards, trickHistory, names, roundWinners, vacant });
    broadcast({ type: 'SEAT_FILLED', idx: vacantIdx, name: d.name });
} else {
    conn.send({ type: 'MSG', msg: '目前沒有空位，無法加入' });
}
```

- [ ] **Step 1: Replace the mid-game join block**

Replace the entire block above with:
```js
if (vacantIdx !== -1) {
    // Record departing player BEFORE overwriting seat state
    departureLedger.push({ name: names[vacantIdx], net: balances[vacantIdx] - buyIns[vacantIdx], balance: balances[vacantIdx], buyIn: buyIns[vacantIdx], seatIdx: vacantIdx });
    connections[vacantIdx - 1] = conn;
    names[vacantIdx] = d.name;
    vacant[vacantIdx] = false;
    disconnected[vacantIdx] = false;
    buyIns[vacantIdx] = balances[vacantIdx];
    conn.on('close', () => handleGuestDisconnect(vacantIdx));
    conn.on('error', () => handleGuestDisconnect(vacantIdx));
    conn.send({ type: 'FULL_STATE', index: vacantIdx, hands, balances, turn, currentCall, hasConfirmed, tableCards, trickHistory, names, roundWinners, vacant, departureLedger });
    broadcast({ type: 'SEAT_FILLED', idx: vacantIdx, name: d.name, buyIn: balances[vacantIdx], ledger: departureLedger });
} else {
    conn.send({ type: 'MSG', msg: '目前沒有空位，無法加入' });
}
```

Note: `buyIn: balances[vacantIdx]` in the broadcast is the new player's starting buy-in (the old player's final balance). `buyIns[vacantIdx]` at this point still holds the OLD player's buy-in — the client will use `data.buyIn` to reset it correctly.

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: 38 passed

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: host records departure to ledger on SEAT_FILLED"
```

---

## Task 3: Client SEAT_FILLED + FULL_STATE receive handlers

**Files:**
- Modify: `index.html` (SEAT_FILLED client handler ~lines 480–490, FULL_STATE receive ~line 406)

- [ ] **Step 1: Update SEAT_FILLED client handler**

Find the SEAT_FILLED client handler (lines 480–490):
```js
if (data.type === 'SEAT_FILLED') {
    vacant[data.idx] = false;
    disconnected[data.idx] = false;
    names[data.idx] = data.name;
    buyIns[data.idx] = balances[data.idx]; // new player's book starts here
    showToast(`${data.name} 已加入遊戲`);
    render();
    if (lastSettleData && document.getElementById('settlement-overlay').style.display === 'flex') {
        showSettle(lastSettleData.diffs, lastSettleData.counts, lastSettleData.lastWinner, lastSettleData.winnerIdx);
    }
}
```

Replace with:
```js
if (data.type === 'SEAT_FILLED') {
    vacant[data.idx] = false;
    disconnected[data.idx] = false;
    names[data.idx] = data.name;
    buyIns[data.idx] = data.buyIn ?? balances[data.idx];
    departureLedger = data.ledger || departureLedger;
    showToast(`${data.name} 已加入遊戲`);
    render();
    if (lastSettleData && document.getElementById('settlement-overlay').style.display === 'flex') {
        showSettle(lastSettleData.diffs, lastSettleData.counts, lastSettleData.lastWinner, lastSettleData.winnerIdx);
    }
}
```

- [ ] **Step 2: Update FULL_STATE receive handler**

Find in the FULL_STATE handler (around line 406):
```js
vacant = data.vacant || [false, false, false, false];
```
Add immediately after it:
```js
departureLedger = data.departureLedger || [];
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: 38 passed

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: client applies departureLedger from SEAT_FILLED and FULL_STATE"
```

---

## Task 4: Rewrite handleRejoin with conflict resolution

**Files:**
- Modify: `index.html` (`handleRejoin` function, lines 691–701)

The current `handleRejoin` function (lines 691–701):
```js
function handleRejoin(conn, d) {
    const idx = d.prevIndex;
    if (idx < 1 || idx > 3 || !names[idx]) return;
    connections[idx - 1] = conn;
    disconnected[idx] = false;
    vacant[idx] = false;
    conn.on('close', () => handleGuestDisconnect(idx));
    conn.on('error', () => handleGuestDisconnect(idx));
    conn.send({ type: 'FULL_STATE', index: idx, hands, balances, turn, currentCall, hasConfirmed, tableCards, trickHistory, names, roundWinners, vacant });
    broadcast({ type: 'MSG', msg: `✅ ${names[idx]} 已重新連線` });
}
```

- [ ] **Step 1: Replace handleRejoin**

Replace the entire function with:
```js
function handleRejoin(conn, d) {
    const idx = d.prevIndex;
    // Guard: invalid index, unknown player, or seat was never vacated
    if (idx < 1 || idx > 3 || !names[idx] || !disconnected[idx]) return;

    if (vacant[idx]) {
        // Normal rejoin — original seat still vacant
        connections[idx - 1] = conn;
        disconnected[idx] = false;
        vacant[idx] = false;
        conn.on('close', () => handleGuestDisconnect(idx));
        conn.on('error', () => handleGuestDisconnect(idx));
        conn.send({ type: 'FULL_STATE', index: idx, hands, balances, turn, currentCall, hasConfirmed, tableCards, trickHistory, names, roundWinners, vacant, departureLedger });
        broadcast({ type: 'SEAT_FILLED', idx, name: d.name, buyIn: buyIns[idx], ledger: departureLedger });
    } else {
        // Seat taken — find another vacant guest seat
        const vacantSeat = vacant.findIndex((v, i) => v && i > 0);
        if (vacantSeat === -1) {
            conn.send({ type: 'MSG', msg: '目前沒有空位，無法加入' });
            return;
        }
        // Retrieve returning player's saved data from ledger
        const entry = departureLedger.find(e => e.seatIdx === idx);
        if (!entry) {
            conn.send({ type: 'MSG', msg: '無法找到玩家資料，無法加入' });
            return;
        }
        // Record the player being displaced from vacantSeat to ledger
        departureLedger.push({ name: names[vacantSeat], net: balances[vacantSeat] - buyIns[vacantSeat], balance: balances[vacantSeat], buyIn: buyIns[vacantSeat], seatIdx: vacantSeat });
        // Remove returning player from ledger (they're back)
        departureLedger = departureLedger.filter(e => e.seatIdx !== idx);
        // Restore returning player to vacantSeat
        names[vacantSeat] = d.name;
        balances[vacantSeat] = entry.balance;
        buyIns[vacantSeat] = entry.buyIn;
        vacant[vacantSeat] = false;
        disconnected[vacantSeat] = false;
        connections[vacantSeat - 1] = conn;
        conn.on('close', () => handleGuestDisconnect(vacantSeat));
        conn.on('error', () => handleGuestDisconnect(vacantSeat));
        conn.send({ type: 'FULL_STATE', index: vacantSeat, hands, balances, turn, currentCall, hasConfirmed, tableCards, trickHistory, names, roundWinners, vacant, departureLedger });
        broadcast({ type: 'SEAT_FILLED', idx: vacantSeat, name: d.name, buyIn: entry.buyIn, ledger: departureLedger });
    }
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: 38 passed

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: handleRejoin resolves seat conflict — restore to any vacant seat"
```

---

## Task 5: Update openStats() to show all players

**Files:**
- Modify: `index.html` (`openStats` function, lines 752–763)

The current `openStats` function (lines 752–763):
```js
function openStats() {
    const tbody = document.getElementById('stats-body');
    tbody.innerHTML = names.map((name, i) => {
        const bal = balances[i];
        const buyIn = buyIns[i];
        const net = bal - buyIn;
        const netClass = net > 0 ? 'net-positive' : net < 0 ? 'net-negative' : 'net-zero';
        const netStr = net > 0 ? '+$' + net : net < 0 ? '-$' + Math.abs(net) : '$0';
        return `<tr><td>${name || '玩家'+(i+1)}</td><td>$${buyIn}</td><td>$${bal}</td><td class="${netClass}">${netStr}</td></tr>`;
    }).join('');
    document.getElementById('stats-overlay').style.display = 'flex';
}
```

- [ ] **Step 1: Replace openStats()**

Replace the entire function with:
```js
function openStats() {
    const tbody = document.getElementById('stats-body');
    const seatRows = names.map((name, i) => {
        const bal = balances[i];
        const buyIn = buyIns[i];
        const net = bal - buyIn;
        const netClass = net > 0 ? 'net-positive' : net < 0 ? 'net-negative' : 'net-zero';
        const netStr = net > 0 ? '+$' + net : net < 0 ? '-$' + Math.abs(net) : '$0';
        const displayName = vacant[i] ? `<i>${name || '玩家'+(i+1)}</i>` : (name || '玩家'+(i+1));
        return `<tr><td>${displayName}</td><td>$${buyIn}</td><td>$${bal}</td><td class="${netClass}">${netStr}</td></tr>`;
    });
    const ledgerRows = departureLedger.map(entry => {
        const netClass = entry.net > 0 ? 'net-positive' : entry.net < 0 ? 'net-negative' : 'net-zero';
        const netStr = entry.net > 0 ? '+$' + entry.net : entry.net < 0 ? '-$' + Math.abs(entry.net) : '$0';
        return `<tr style="opacity:0.6"><td><i>${entry.name}</i></td><td>—</td><td>—</td><td class="${netClass}">${netStr}</td></tr>`;
    });
    tbody.innerHTML = seatRows.concat(ledgerRows).join('');
    document.getElementById('stats-overlay').style.display = 'flex';
}
```

Active seats show all 4 columns. Vacant seats show the same (still-live values from the arrays) with the name italicised. Ledger entries show `—` for 總買入 and 當前餘額, the net for 淨輸贏, with the row dimmed to 60% opacity.

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: 38 passed

- [ ] **Step 3: Manual check**

Open browser console on the game page and run:
```js
vacant[1] = true;
departureLedger.push({name:'測試玩家', net:-200, balance:4800, buyIn:5000, seatIdx:1});
openStats();
```
Expected: stats overlay shows 4 seat rows (seat 2 italicised) + 1 dimmed ledger row for 測試玩家 with -$200.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: openStats shows all-time players including departed ledger entries"
```

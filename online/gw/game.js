/* =========================================================
   حدس بکش - Draw & Guess Game
   معماری: Host-Relay (میزبان مرکز ارتباطات است)
   ========================================================= */

// ---------- Word Bank ----------
const WORD_BANK = [
  "دکتر","معلم","خلبان","نجار","آشپز","پلیس","کشاورز","نقاش","خواننده","مهندس",
  "شیر","فیل","گربه","سگ","اسب","مرغ","ماهی","خرگوش","گاو","گوسفند",
  "سیب","موز","هندوانه","توپ","کتاب","ماشین","هواپیما","دوچرخه","قطار","کشتی",
  "خورشید","ماه","ستاره","ابر","باران","برف","کوه","دریا","رودخانه","جنگل",
  "خانه","مدرسه","بیمارستان","مسجد","برج","پل","چتر","عینک","ساعت","کلاه",
  "گیتار","پیانو","طبل","توپ فوتبال","بستنی","کیک","پیتزا","همبرگر","چای","قهوه",
  "کامپیوتر","موبایل","تلویزیون","دوربین","ربات","فضاپیما","سیاره","اژدها","جادوگر","پادشاه"
];

function getRandomWords(count, exclude=[]) {
  const pool = WORD_BANK.filter(w => !exclude.includes(w));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ---------- Global State ----------
let peer = null;
let isHost = false;
let myId = null;
let myName = "";
let connections = {}; // hostside: {peerId: DataConnection}
let hostConn = null;  // clientside: connection to host

let players = []; // {id, name, score, hasDrawnCount}
let gameConfig = { drawTime: 80, rounds: 2 };

let gameState = {
  round: 1,
  totalRounds: 1,
  drawOrder: [],       // آرایه‌ای از player id ها به ترتیب نوبت
  currentDrawerIndex: -1,
  currentWord: "",
  timeLeft: 0,
  timerInterval: null,
  correctGuessers: [],  // کسانی که در این راند درست حدس زدند
  roundActive: false,
  usedWords: []
};

// ---------- DOM Refs ----------
const el = (id) => document.getElementById(id);

const screens = {
  setup: el("setupScreen"),
  lobby: el("lobbyScreen"),
  game: el("gameScreen")
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

// ============================================================
// SETUP SCREEN LOGIC
// ============================================================
el("btnGoHost").addEventListener("click", () => {
  myName = el("playerNameInput").value.trim() || "میزبان";
  isHost = true;
  initPeerAsHost();
});

el("btnJoin").addEventListener("click", () => {
  myName = el("playerNameInput").value.trim() || "بازیکن";
  let code = el("joinCodeInput").value.trim();
  // extract room code if a full URL was pasted
  const match = code.match(/room=([a-zA-Z0-9\-]+)/);
  if (match) code = match[1];
  if (!code) { alert("کد اتاق را وارد کنید"); return; }
  isHost = false;
  initPeerAsClient(code);
});

// Auto-fill join code from URL
window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  if (room) el("joinCodeInput").value = room;
});

// Smart paste detection in join box
el("joinCodeInput").addEventListener("input", (e) => {
  const val = e.target.value;
  const match = val.match(/room=([a-zA-Z0-9\-]+)/);
  if (match) e.target.value = match[1];
});

// ============================================================
// PEER CONFIGURATION (STUN/TURN for NAT traversal)
// ============================================================
const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ]
  }
};

// ============================================================
// HOST NETWORKING
// ============================================================
function initPeerAsHost() {
  peer = new Peer(undefined, PEER_CONFIG);

  peer.on("open", (id) => {
    myId = id;
    players = [{ id: myId, name: myName, score: 0, hasDrawnCount: 0 }];
    renderLobbyPlayers();
    setupLobbyForHost(id);
    showScreen("lobby");
  });

  peer.on("connection", (conn) => {
    connections[conn.peer] = conn;

    conn.on("open", () => {
      conn.on("data", (data) => handleHostReceivedData(conn.peer, data));
      conn.on("close", () => handlePlayerDisconnect(conn.peer));
    });
  });

  peer.on("error", (err) => {
    console.error(err);
    alert("خطای اتصال: " + err.type);
  });
}

function setupLobbyForHost(id) {
  const link = `${window.location.origin}${window.location.pathname}?room=${id}`;
  el("inviteLinkBox").value = link;
  el("hostSettings").classList.remove("hidden");
  el("waitingMsg").classList.add("hidden");
}

el("btnCopyLink").addEventListener("click", () => {
  el("inviteLinkBox").select();
  navigator.clipboard.writeText(el("inviteLinkBox").value);
  const btn = el("btnCopyLink");
  const old = btn.textContent;
  btn.textContent = "کپی شد!";
  setTimeout(() => btn.textContent = old, 1500);
});

function handleHostReceivedData(fromId, data) {
  switch (data.type) {
    case "join":
      players.push({ id: fromId, name: data.name, score: 0, hasDrawnCount: 0 });
      renderLobbyPlayers();
      broadcastToAll({ type: "playerList", players }, fromId);
      // send current state to the newcomer alone (in case they joined mid-lobby)
      sendTo(fromId, { type: "playerList", players });
      break;

    case "chat":
      handleGuessOrChat(fromId, data.text);
      break;

    case "drawData":
      // relay drawing strokes to everyone else
      broadcastToAll({ type: "drawData", payload: data.payload }, fromId);
      break;

    case "clearCanvas":
      broadcastToAll({ type: "clearCanvas" }, fromId);
      break;

    case "wordChosen":
      onWordChosen(data.word);
      break;
  }
}

function handlePlayerDisconnect(id) {
  delete connections[id];
  const wasDrawer = gameState.drawOrder[gameState.currentDrawerIndex] === id;
  players = players.filter(p => p.id !== id);
  renderLobbyPlayers();
  broadcastToAll({ type: "playerList", players });
  broadcastSystemMsg(`یک بازیکن از بازی خارج شد`);

  if (gameState.roundActive) {
    renderGamePlayers();
    if (wasDrawer) {
      // skip to next player's turn
      endRound(true);
    }
  }
}

function sendTo(id, data) {
  if (connections[id] && connections[id].open) connections[id].send(data);
}

function broadcastToAll(data, exceptId=null) {
  Object.keys(connections).forEach(id => {
    if (id !== exceptId) sendTo(id, data);
  });
}

// ============================================================
// CLIENT NETWORKING
// ============================================================
function initPeerAsClient(hostId) {
  peer = new Peer(undefined, PEER_CONFIG);

  peer.on("open", (id) => {
    myId = id;
    hostConn = peer.connect(hostId, { reliable: true });

    hostConn.on("open", () => {
      hostConn.send({ type: "join", name: myName });
      showScreen("lobby");
      el("hostSettings").classList.add("hidden");
      el("waitingMsg").classList.remove("hidden");
      el("inviteLinkBox").value = `${window.location.origin}${window.location.pathname}?room=${hostId}`;
    });

    hostConn.on("data", (data) => handleClientReceivedData(data));
    hostConn.on("close", () => {
      alert("اتصال با میزبان قطع شد.");
      location.reload();
    });
  });

  peer.on("error", (err) => {
    console.error(err);
    alert("خطای اتصال: " + err.type + " — کد اتاق را بررسی کنید.");
  });
}

function handleClientReceivedData(data) {
  switch (data.type) {
    case "playerList":
      players = data.players;
      renderLobbyPlayers();
      renderGamePlayers();
      break;

    case "gameStart":
      gameConfig = data.config;
      gameState.totalRounds = data.config.rounds;
      startGameUI();
      break;

    case "yourTurnToChoose":
      showWordChoiceOverlay(data.words);
      break;

    case "roundStart":
      onRoundStart(data);
      break;

    case "drawData":
      applyRemoteDraw(data.payload);
      break;

    case "clearCanvas":
      clearCanvasLocal(false);
      break;

    case "timerUpdate":
      updateTimerDisplay(data.timeLeft, data.total);
      break;

    case "chatMsg":
      renderChatMessage(data);
      break;

    case "roundEnd":
      onRoundEnd(data);
      break;

    case "gameEnd":
      showFinalResults(data.players);
      break;

    case "scoreUpdate":
      players = data.players;
      renderGamePlayers();
      break;
  }
}

// Helper: send data whether I'm host or client
function sendToServerOrSelf(data) {
  if (isHost) {
    handleHostReceivedData(myId, data);
  } else {
    hostConn.send(data);
  }
}

// ============================================================
// LOBBY RENDERING
// ============================================================
function renderLobbyPlayers() {
  el("playerCountLbl").textContent = players.length;
  const container = el("lobbyPlayerList");
  container.innerHTML = "";
  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "player-item";
    div.innerHTML = `<div class="name">${p.id === myId ? "👑" : "👤"} ${p.name}</div>`;
    container.appendChild(div);
  });
}

// Host starts the game
el("btnStartGame").addEventListener("click", () => {
  if (players.length < 2) {
    alert("حداقل ۲ بازیکن لازم است");
    return;
  }
  const drawTime = parseInt(el("drawTimeInput").value) || 80;
  const rounds = parseInt(el("roundsInput").value) || 2;
  gameConfig = { drawTime, rounds };

  gameState.drawOrder = [];
  for (let r = 0; r < rounds; r++) {
    players.forEach(p => gameState.drawOrder.push(p.id));
  }
  gameState.currentDrawerIndex = -1;
  gameState.totalRounds = gameState.drawOrder.length;
  gameState.usedWords = [];

  players.forEach(p => p.score = 0);

  broadcastToAll({ type: "gameStart", config: { ...gameConfig, rounds: gameState.totalRounds } });
  startGameUI();
  nextTurn();
});

// ============================================================
// GAME UI INIT
// ============================================================
function startGameUI() {
  showScreen("game");
  el("totalRoundsLbl").textContent = gameState.totalRounds;
  renderGamePlayers();
  resizeCanvas();
}

// ============================================================
// TURN MANAGEMENT (HOST ONLY LOGIC, but functions guarded)
// ============================================================
function nextTurn() {
  if (!isHost) return;

  gameState.currentDrawerIndex++;
  el("roundLbl").textContent = gameState.currentDrawerIndex + 1;

  if (gameState.currentDrawerIndex >= gameState.drawOrder.length) {
    endGame();
    return;
  }

  const drawerId = gameState.drawOrder[gameState.currentDrawerIndex];
  gameState.correctGuessers = [];
  gameState.roundActive = false;

  const words = getRandomWords(5, gameState.usedWords);

  if (drawerId === myId) {
    showWordChoiceOverlay(words);
  } else {
    sendTo(drawerId, { type: "yourTurnToChoose", words });
  }

  broadcastSystemMsg(`نوبت نقاشی ${getPlayerName(drawerId)} است...`, drawerId !== myId);
}

function getPlayerName(id) {
  const p = players.find(pl => pl.id === id);
  return p ? p.name : "بازیکن";
}

// ============================================================
// WORD CHOICE
// ============================================================
function showWordChoiceOverlay(words) {
  el("wordChoiceOverlay").classList.remove("hidden");
  const box = el("wordOptionsBox");
  box.innerHTML = "";
  words.forEach(w => {
    const btn = document.createElement("button");
    btn.className = "word-btn";
    btn.textContent = w;
    btn.onclick = () => {
      el("wordChoiceOverlay").classList.add("hidden");
      sendToServerOrSelf({ type: "wordChosen", word: w });
    };
    box.appendChild(btn);
  });
}

function onWordChosen(word) {
  if (!isHost) return;
  gameState.currentWord = word;
  gameState.usedWords.push(word);
  const drawerId = gameState.drawOrder[gameState.currentDrawerIndex];

  gameState.roundActive = true;
  gameState.timeLeft = gameConfig.drawTime;

  const payload = {
    type: "roundStart",
    drawerId,
    drawerName: getPlayerName(drawerId),
    wordLength: word.length,
    round: gameState.currentDrawerIndex + 1,
    totalRounds: gameState.totalRounds,
    time: gameConfig.drawTime
  };

  // send full word only to drawer
  if (drawerId === myId) {
    onRoundStart({ ...payload, word });
  } else {
    sendTo(drawerId, { ...payload, word });
  }
  broadcastToAll({ ...payload }, drawerId);

  startHostTimer();
}

function onRoundStart(data) {
  gameState.currentDrawerId = data.drawerId;
  gameState.isMeDrawing = (data.drawerId === myId);
  el("roundLbl").textContent = data.round;
  el("totalRoundsLbl").textContent = data.totalRounds;

  if (gameState.isMeDrawing) {
    el("wordDisplay").textContent = data.word;
  } else {
    el("wordDisplay").textContent = "_ ".repeat(data.wordLength).trim();
    gameState.blankWord = "_".repeat(data.wordLength).split("");
  }

  gameState.wordLength = data.wordLength;
  gameState.hasGuessedCorrectly = false;
  clearCanvasLocal(false);
  setDrawingEnabled(gameState.isMeDrawing);
  renderGamePlayers();
  broadcastLocalSystemMsg(`نوبت رسم ${data.drawerName} — حدس بزنید!`);
}

// ============================================================
// TIMER (HOST controls, broadcasts updates)
// ============================================================
function startHostTimer() {
  clearInterval(gameState.timerInterval);
  updateTimerDisplay(gameState.timeLeft, gameConfig.drawTime);
  broadcastToAll({ type: "timerUpdate", timeLeft: gameState.timeLeft, total: gameConfig.drawTime });

  gameState.timerInterval = setInterval(() => {
    gameState.timeLeft--;

    // reveal a random letter at certain checkpoints
    maybeRevealLetter();

    if (myId === gameState.currentDrawerId || isHost) {
      // host applies locally too
    }
    updateTimerDisplay(gameState.timeLeft, gameConfig.drawTime);
    broadcastToAll({ type: "timerUpdate", timeLeft: gameState.timeLeft, total: gameConfig.drawTime });

    const allGuessed = gameState.correctGuessers.length >= (players.length - 1) && players.length > 1;

    if (gameState.timeLeft <= 0 || allGuessed) {
      clearInterval(gameState.timerInterval);
      endRound(false);
    }
  }, 1000);
}

function maybeRevealLetter() {
  if (!isHost) return;
  const total = gameConfig.drawTime;
  const elapsed = total - gameState.timeLeft;
  const revealEvery = Math.max(8, Math.floor(total / 4)); // up to ~3 reveals
  if (elapsed > 0 && elapsed % revealEvery === 0) {
    const word = gameState.currentWord;
    const hiddenIndexes = [];
    for (let i = 0; i < word.length; i++) {
      if (!gameState.revealedIndexes || !gameState.revealedIndexes.includes(i)) {
        hiddenIndexes.push(i);
      }
    }
    if (hiddenIndexes.length <= 1) return; // keep at least 1 hidden
    const idx = hiddenIndexes[Math.floor(Math.random() * hiddenIndexes.length)];
    if (!gameState.revealedIndexes) gameState.revealedIndexes = [];
    gameState.revealedIndexes.push(idx);
    broadcastToAll({ type: "letterReveal", index: idx, letter: word[idx] });
    handleLetterReveal(idx, word[idx]);
  }
}

function handleLetterReveal(index, letter) {
  if (gameState.isMeDrawing) return;
  if (!gameState.blankWord) return;
  gameState.blankWord[index] = letter;
  el("wordDisplay").textContent = gameState.blankWord.join(" ");
}

function updateTimerDisplay(timeLeft, total) {
  gameState.timeLeft = timeLeft;
  const pct = Math.max(0, (timeLeft / total) * 100);
  const circle = el("timerCircle");
  circle.style.setProperty("--p", pct + "%");
  circle.textContent = timeLeft;
  if (timeLeft <= 10) circle.style.background = `conic-gradient(#e74c3c ${pct}%, rgba(255,255,255,0.15) 0)`;
  else circle.style.background = `conic-gradient(#ffd700 ${pct}%, rgba(255,255,255,0.15) 0)`;
}

// ============================================================
// END ROUND / END GAME (HOST)
// ============================================================
function endRound(drawerDisconnected) {
  if (!isHost) return;
  clearInterval(gameState.timerInterval);
  gameState.roundActive = false;
  gameState.revealedIndexes = [];

  // reward drawer if at least one person guessed correctly
  if (gameState.correctGuessers.length > 0) {
    const drawer = players.find(p => p.id === gameState.currentDrawerId);
    if (drawer) drawer.score += 30 + gameState.correctGuessers.length * 10;
  }

  broadcastToAll({ type: "scoreUpdate", players });
  broadcastToAll({
    type: "roundEnd",
    word: gameState.currentWord,
    drawerDisconnected
  });
  onRoundEnd({ word: gameState.currentWord, drawerDisconnected }); // apply locally for host

  setTimeout(() => {
    nextTurn();
  }, 3500);
}

function onRoundEnd(data) {
  setDrawingEnabled(false);
  broadcastLocalSystemMsg(`⏱️ کلمه «${data.word}» بود!`);
  el("wordDisplay").textContent = data.word;
}

function endGame() {
  if (!isHost) return;
  broadcastToAll({ type: "gameEnd", players });
  showFinalResults(players);
}

function showFinalResults(finalPlayers) {
  clearInterval(gameState.timerInterval);
  const sorted = [...finalPlayers].sort((a, b) => b.score - a.score);
  const box = el("finalListBox");
  box.innerHTML = "";
  sorted.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "final-item" + (i === 0 ? " first" : "");
    div.innerHTML = `<span>${i === 0 ? "🏆 " : `${i+1}. `}${p.name}</span><span>${p.score} امتیاز</span>`;
    box.appendChild(div);
  });
  el("finalOverlay").classList.remove("hidden");
}

el("btnBackToSetup").addEventListener("click", () => location.reload());

// ============================================================
// CHAT / GUESSING LOGIC
// ============================================================
el("btnSendChat").addEventListener("click", sendChatMessage);
el("chatInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

function sendChatMessage() {
  const input = el("chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  sendToServerOrSelf({ type: "chat", text });
}

function handleGuessOrChat(fromId, text) {
  if (!isHost) return;

  const player = players.find(p => p.id === fromId);
  if (!player) return;

  const isDrawer = fromId === gameState.currentDrawerId;
  const alreadyGuessed = gameState.correctGuessers.includes(fromId);

  if (gameState.roundActive && !isDrawer && !alreadyGuessed) {
    const normalized = normalizeText(text);
    const target = normalizeText(gameState.currentWord);

    if (normalized === target) {
      // correct guess!
      const rank = gameState.correctGuessers.length;
      const points = Math.max(10, 100 - rank * 20 - Math.floor((gameConfig.drawTime - gameState.timeLeft) * 0.5));
      player.score += points;
      gameState.correctGuessers.push(fromId);

      broadcastToAll({ type: "scoreUpdate", players });
      broadcastToAll({ type: "chatMsg", from: player.name, text: "کلمه را حدس زد! ✅", kind: "correct" });
      renderChatMessage({ from: player.name, text: "کلمه را حدس زد! ✅", kind: "correct" });

      // send private confirmation to the guesser only
      sendTo(fromId, { type: "chatMsg", from: "سیستم", text: `درست بود! +${points} امتیاز`, kind: "system" });

      const allGuessed = gameState.correctGuessers.length >= (players.length - 1);
      if (allGuessed) {
        clearInterval(gameState.timerInterval);
        endRound(false);
      }
      return;
    } else if (isCloseGuess(normalized, target)) {
      sendTo(fromId, { type: "chatMsg", from: "سیستم", text: `«${text}» نزدیک بود! 🔥`, kind: "close" });
      return;
    }
  }

  // regular chat message (broadcast to all, censored if drawer or already-guessed tries to leak word)
  let displayText = text;
  if (gameState.roundActive && normalizeText(text) === normalizeText(gameState.currentWord) && !isDrawer) {
    displayText = "•".repeat(text.length); // shouldn't reach here normally, safety net
  }

  broadcastToAll({ type: "chatMsg", from: player.name, text: displayText, kind: "normal" });
  renderChatMessage({ from: player.name, text: displayText, kind: "normal" });
}

function normalizeText(str) {
  return str.trim().toLowerCase().replace(/[\u200c\s]+/g, "");
}

function isCloseGuess(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let diff = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff > 0 && diff <= 2;
}

function renderChatMessage(data) {
  const container = el("chatMessages");
  const div = document.createElement("div");
  div.className = "chat-msg " + (data.kind || "normal");
  if (data.kind === "system" || data.kind === "close") {
    div.textContent = data.text;
  } else if (data.kind === "correct") {
    div.textContent = `${data.from} ${data.text}`;
  } else {
    div.textContent = `${data.from}: ${data.text}`;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function broadcastSystemMsg(text, alsoLocal=true) {
  const msg = { type: "chatMsg", from: "سیستم", text, kind: "system" };
  broadcastToAll(msg);
  if (alsoLocal) renderChatMessage(msg);
}

function broadcastLocalSystemMsg(text) {
  renderChatMessage({ from: "سیستم", text, kind: "system" });
}

// ============================================================
// PLAYERS PANEL (in-game)
// ============================================================
function renderGamePlayers() {
  const container = el("gamePlayerList");
  container.innerHTML = "";
  const sorted = [...players].sort((a, b) => b.score - a.score);
  sorted.forEach((p, i) => {
    const div = document.createElement("div");
    const isDrawing = p.id === gameState.currentDrawerId;
    div.className = "player-item" + (isDrawing ? " drawing" : "");
    div.innerHTML = `
      <div class="name">${i === 0 && p.score > 0 ? '<span class="crown">👑</span>' : ''} ${isDrawing ? "✏️" : ""} ${p.name}</div>
      <div class="score">${p.score}</div>
    `;
    container.appendChild(div);
  });
}

// ============================================================
// CANVAS / DRAWING LOGIC
// ============================================================
const canvas = el("drawCanvas");
const ctx = canvas.getContext("2d");
let drawing = false;
let currentColor = "#000000";
let currentSize = 5;
let lastX = 0, lastY = 0;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const prevImage = canvas.width > 0 ? canvas.toDataURL() : null;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}
window.addEventListener("resize", () => {
  setTimeout(resizeCanvas, 200);
});

function setDrawingEnabled(enabled) {
  canvas.style.pointerEvents = enabled ? "auto" : "none";
  canvas.style.cursor = enabled ? "crosshair" : "default";
  el("toolsBar").style.opacity = enabled ? "1" : "0.4";
  el("toolsBar").style.pointerEvents = enabled ? "auto" : "none";
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height
  };
}

function startDraw(e) {
  if (canvas.style.pointerEvents === "none") return;
  drawing = true;
  const pos = getPos(e);
  lastX = pos.x; lastY = pos.y;
}

function moveDraw(e) {
  if (!drawing) return;
  e.preventDefault();
  const pos = getPos(e);
  drawLine(lastX, lastY, pos.x, pos.y, currentColor, currentSize, true);
  lastX = pos.x; lastY = pos.y;
}

function endDraw() { drawing = false; }

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", moveDraw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("mouseleave", endDraw);
canvas.addEventListener("touchstart", startDraw, { passive:false });
canvas.addEventListener("touchmove", moveDraw, { passive:false });
canvas.addEventListener("touchend", endDraw);

function drawLine(x1, y1, x2, y2, color, size, shouldBroadcast) {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.beginPath();
  ctx.moveTo(x1 * w, y1 * h);
  ctx.lineTo(x2 * w, y2 * h);
  ctx.stroke();

  if (shouldBroadcast) {
    const payload = { x1, y1, x2, y2, color, size };
    sendToServerOrSelfDraw(payload);
  }
}

function sendToServerOrSelfDraw(payload) {
  if (isHost) {
    broadcastToAll({ type: "drawData", payload });
  } else {
    hostConn.send({ type: "drawData", payload });
  }
}

function applyRemoteDraw(payload) {
  drawLine(payload.x1, payload.y1, payload.x2, payload.y2, payload.color, payload.size, false);
}

function clearCanvasLocal(shouldBroadcast) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (shouldBroadcast) {
    if (isHost) {
      broadcastToAll({ type: "clearCanvas" });
    } else {
      hostConn.send({ type: "clearCanvas" });
    }
  }
}

el("btnClearCanvas").addEventListener("click", () => {
  clearCanvasLocal(true);
});

// color & brush tools
document.querySelectorAll(".color-swatch").forEach(sw => {
  sw.addEventListener("click", () => {
    document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
    sw.classList.add("active");
    currentColor = sw.dataset.color;
  });
});
el("brushSize").addEventListener("input", (e) => {
  currentSize = parseInt(e.target.value);
});

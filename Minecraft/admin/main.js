// const apiUrl = "http://94.182.170.153:8123/status?key=abc123";
const apiUrl = "/mcapi/status";

const statusDot = document.getElementById("statusDot");
const serverStatus = document.getElementById("serverStatus");
const playerCount = document.getElementById("playerCount");
const playerList = document.getElementById("playerList");

const toggleOfflineBtn = document.getElementById("toggleOfflineBtn");
const offlineWrap = document.getElementById("offlineWrap");
const offlineList = document.getElementById("offlineList");


const KNOWN_KEY = "knownPlayers_v1";

function loadKnownPlayers() {
  try {
    const raw = localStorage.getItem(KNOWN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveKnownPlayers(obj) {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(obj));
  } catch {}
}

let knownPlayers = loadKnownPlayers();


let showOffline = localStorage.getItem("showOffline") === "1";

function syncOfflineUI() {
  if (!toggleOfflineBtn) return;

  toggleOfflineBtn.textContent = showOffline ? "مخفی کردن آفلاین‌ها" : "لیست شهرندان آنلاین";
  if (offlineWrap) offlineWrap.classList.toggle("hidden", !showOffline);
}

if (toggleOfflineBtn) {
  toggleOfflineBtn.addEventListener("click", () => {
    showOffline = !showOffline;
    localStorage.setItem("showOffline", showOffline ? "1" : "0");
    syncOfflineUI();
    loadServerStatus();
  });
}


function formatTime(min) {
  if (min === -1) return "∞";
  if (typeof min !== "number") return "نامشخص";
  return `${min} دقیقه`;
}

function getTimeClass(min) {
  if (min === -1) return "time-infinity";
  if (typeof min !== "number") return "time-orange";
  if (min <= 5) return "time-red";
  if (min <= 10) return "time-orange";
  return "time-green";
}

function formatRelative(msAgo) {
  const sec = Math.floor(msAgo / 1000);
  if (sec < 30) return "چند ثانیه پیش";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} دقیقه پیش`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} ساعت پیش`;

  const day = Math.floor(hour / 24);
  return `${day} روز پیش`;
}

function formatLastSeen(p) {
  // اگر API شما چیزی مثل lastSeenMinutes بده
  if (typeof p.lastSeenMinutes === "number") return `${p.lastSeenMinutes} دقیقه پیش`;
  if (typeof p.lastSeenMin === "number") return `${p.lastSeenMin} دقیقه پیش`;


  if (p.lastSeenAt) {
    const t = typeof p.lastSeenAt === "number" ? p.lastSeenAt : Date.parse(p.lastSeenAt);
    if (!Number.isNaN(t)) return formatRelative(Date.now() - t);
  }


  if (typeof p._lastSeenAt === "number") {
    return formatRelative(Date.now() - p._lastSeenAt);
  }

  return "نامشخص";
}

function makePlayerTag(p, { offline = false } = {}) {
  const tag = document.createElement("div");
  tag.className = `player-tag${offline ? " offline" : ""}`;

  const avatar = document.createElement("img");
  avatar.src = `https://mc-heads.net/avatar/${encodeURIComponent(p.name)}/32`;
  avatar.alt = p.name;

  const username = document.createElement("span");
  username.textContent = p.name;

  tag.appendChild(avatar);
  tag.appendChild(username);

  if (!offline) {
    const time = document.createElement("span");
    time.className = `time ${getTimeClass(p.minutesLeft)}`;
    time.textContent = `— ${formatTime(p.minutesLeft)}`;
    tag.appendChild(time);
  } else {
    const lastSeen = document.createElement("span");
    lastSeen.className = "last-seen";
    lastSeen.textContent = `— آخرین حضور: ${formatLastSeen(p)}`;
    tag.appendChild(lastSeen);
  }

  return tag;
}

function normalizeOfflinePlayers(data) {

  let offline =
    data.offlinePlayers ||
    data.playersOffline ||
    data.offline ||
    data.offline_players ||
    data.offlineUsers ||
    [];

  if (!Array.isArray(offline)) offline = [];

  if (offline.length === 0 && Array.isArray(data.allPlayers) && Array.isArray(data.players)) {
    const onlineSet = new Set(data.players.map(p => p.name));
    offline = data.allPlayers
      .filter(p => p?.name && !onlineSet.has(p.name))
      .map(p => ({ ...p }));
  }

  return offline;
}

async function loadServerStatus() {
  try {
    const response = await fetch(apiUrl, { cache: "no-store" });
    const data = await response.json();

    if (data.error) throw new Error(data.error);

    statusDot.className = "status-dot status-online";
    serverStatus.textContent = "سرور آنلاین است";

    const players = Array.isArray(data.players) ? data.players : [];
    const online = players.length;
    const max = data.max ?? "?";

    const now = Date.now();
    players.forEach(p => {
      if (p?.name) knownPlayers[p.name] = now;
    });
    saveKnownPlayers(knownPlayers);

    // playerCount.textContent = `👥 ${online} شهروند داخل شهر حضور دارد `;
    if (online === 0) {
      playerCount.textContent = `👥 هیچ شهروندی داخل شهر نیست`;
    } else if (online === 1) {
      playerCount.textContent = `👥 ۱ شهروند داخل شهر حضور دارد`;
    } else {
      playerCount.textContent = `👥 ${online} شهروند داخل شهر حضور دارند`;
    }
    

    playerList.innerHTML = "";

    if (players.length === 0) {
      playerList.innerHTML = "فعلاً کسی داخل شهر نیست 🎈";
    } else {
      players.forEach(p => {
        if (p?.name) playerList.appendChild(makePlayerTag(p, { offline: false }));
      });
    }

    // رندر آفلاین‌ها (اگر toggle روشن باشد)
    if (offlineList) offlineList.innerHTML = "";

    if (showOffline) {
      const onlineSet = new Set(players.map(p => p.name));

      // اول تلاش می‌کنیم از API بگیریم
      let offlinePlayers = normalizeOfflinePlayers(data);

      // اگر API چیزی نداد، از knownPlayers مرورگر استفاده می‌کنیم
      if (!offlinePlayers || offlinePlayers.length === 0) {
        offlinePlayers = Object.entries(knownPlayers)
          .filter(([name]) => !onlineSet.has(name))
          .map(([name, lastSeenAt]) => ({
            name,
            _lastSeenAt: lastSeenAt
          }));
      }

      if (!offlinePlayers || offlinePlayers.length === 0) {
        if (offlineList) {
          offlineList.innerHTML = `<div class="empty-offline">فعلاً آفلاینی برای نمایش نداریم.</div>`;
        }
      } else {
        offlinePlayers.forEach(p => {
          if (p?.name && offlineList) offlineList.appendChild(makePlayerTag(p, { offline: true }));
        });
      }
    }

  } catch (error) {
    statusDot.className = "status-dot status-offline";
    serverStatus.textContent = "سرور آفلاین / API در دسترس نیست";
    playerCount.textContent = "";
    playerList.innerHTML = "";
    if (offlineList) offlineList.innerHTML = "";
    console.error(error);
  }
}

// شروع
syncOfflineUI();
loadServerStatus();
setInterval(loadServerStatus, 15000);

const serverIpEl = document.getElementById("serverIp");
const toast = document.getElementById("toast");

function showToast(message){
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

if (serverIpEl) {
  serverIpEl.addEventListener("click", async () => {
    const ip = serverIpEl.querySelector(".ip-text").textContent.trim();

    try {
      await navigator.clipboard.writeText(ip);
      showToast(" آی‌پی سرور کپی شد");
    } catch (e) {
      showToast("❌ کپی انجام نشد");
    }
  });
}









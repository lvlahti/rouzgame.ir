const SERVER_IP = "94.182.170.153:25575";

// گزینه 1: mcstatus.io
const apiUrl = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(SERVER_IP)}`;

const statusDot = document.getElementById("statusDot");
const serverStatus = document.getElementById("serverStatus");
const playerCount = document.getElementById("playerCount");
const playerList = document.getElementById("playerList");

function makePlayerTagByName(name) {
  const tag = document.createElement("div");
  tag.className = "player-tag";

  const avatar = document.createElement("img");
  avatar.src = `https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`;
  avatar.alt = name;

  const username = document.createElement("span");
  username.textContent = name;

  tag.appendChild(avatar);
  tag.appendChild(username);

  return tag;
}

async function loadServerStatus() {
  try {
    const res = await fetch(apiUrl, { cache: "no-store" });
    const data = await res.json();

    // آنلاین؟
    if (!data?.online) throw new Error("offline");

    statusDot.className = "status-dot status-online";
    serverStatus.textContent = "سرور آنلاین است";

    const online = data.players?.online ?? 0;
    const max = data.players?.max ?? "?";

    if (online === 0) playerCount.textContent = "هیچ شهروندی آنلاین نیست";
    else if (online === 1) playerCount.textContent = "۱ شهروند آنلاین است";
    else playerCount.textContent = `${online} شهروند آنلاین هستند`;

    playerList.innerHTML = "";

    // sample معمولاً تعداد محدودی پلیر میده
    const sample = Array.isArray(data.players?.sample) ? data.players.sample : [];

    if (sample.length === 0) {
      playerList.innerHTML = "لیست پلیرها توسط سرور منتشر نمی‌شود (Sample ندارد).";
      return;
    }

    sample.forEach(p => {
      const name = p.name_clean || p.name || p.username;
      if (name) playerList.appendChild(makePlayerTagByName(name));
    });
  } catch (e) {
    statusDot.className = "status-dot status-offline";
    serverStatus.textContent = "سرور آفلاین / قابل دریافت نیست";
    playerCount.textContent = "";
    playerList.innerHTML = "";
    console.error(e);
  }
}

loadServerStatus();
setInterval(loadServerStatus, 15000);


const apiUrl = "https://94.182.170.153:8123/status?key=abc123";

const statusDot = document.getElementById("statusDot");
const serverStatus = document.getElementById("serverStatus");
const playerCount = document.getElementById("playerCount");
const playerList = document.getElementById("playerList");

function formatTime(min) {
  if (min === -1) return "∞";
  return `${min} دقیقه`;
}

function getTimeClass(min) {
  if (min === -1) return "time-infinity";
  if (min <= 5) return "time-red";
  if (min <= 10) return "time-orange";
  return "time-green";
}

async function loadServerStatus() {
  try {
    const response = await fetch(apiUrl, { cache: "no-store" });
    const data = await response.json();

    if (data.error) throw new Error(data.error);

    statusDot.className = "status-dot status-online";
    serverStatus.textContent = "سرور آنلاین است";

    const players = data.players || [];
    const online = players.length;
    const max = data.max ?? "?";

    playerCount.textContent = `👥 ${online} / ${max} بازیکن آنلاین`;
    playerList.innerHTML = "";

    if (players.length === 0) {
      playerList.innerHTML = "فعلاً کسی داخل شهر نیست 🎈";
      return;
    }

    players.forEach(p => {
      const tag = document.createElement("div");
      tag.className = "player-tag";

      const avatar = document.createElement("img");
      avatar.src = `https://mc-heads.net/avatar/${encodeURIComponent(p.name)}/32`;
      avatar.alt = p.name;

      const username = document.createElement("span");
      username.textContent = p.name;

      const time = document.createElement("span");
      time.className = `time ${getTimeClass(p.minutesLeft)}`;
      time.textContent = `— ${formatTime(p.minutesLeft)}`;

      tag.appendChild(avatar);
      tag.appendChild(username);
      tag.appendChild(time);

      playerList.appendChild(tag);
    });

  } catch (error) {
    statusDot.className = "status-dot status-offline";
    serverStatus.textContent = "سرور آفلاین / API در دسترس نیست";
    playerCount.textContent = "";
    playerList.innerHTML = "";
    console.error(error);
  }
}

loadServerStatus();
setInterval(loadServerStatus, 15000);


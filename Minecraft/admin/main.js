const serverIP = "94.182.170.153:25565";
const statusDot = document.getElementById("statusDot");
const serverStatus = document.getElementById("serverStatus");
const playerCount = document.getElementById("playerCount");
const playerList = document.getElementById("playerList");

async function loadServerStatus() {
  try {
    const response = await fetch(`https://api.mcsrvstat.us/2/${serverIP}`);
    const data = await response.json();

    if (!data.online) {
      statusDot.className = "status-dot status-offline";
      serverStatus.textContent = "سرور آفلاین است";
      playerCount.textContent = "";
      playerList.innerHTML = "";
      return;
    }

    statusDot.className = "status-dot status-online";
    serverStatus.textContent = "سرور آنلاین است";

    const online = data.players?.online ?? 0;
    const max = data.players?.max ?? "?";
    playerCount.textContent = `👥 ${online} / ${max} بازیکن آنلاین`;

    const players = data.players?.list || [];
    playerList.innerHTML = "";

    if (players.length === 0) {
      playerList.innerHTML = "فعلاً کسی داخل شهر نیست 🎈";
    } else {
      players.forEach(name => {
        const tag = document.createElement("div");
        tag.className = "player-tag";

        const avatar = document.createElement("img");
        avatar.src = `https://mc-heads.net/avatar/${name}/32`;
        avatar.alt = name;

        const username = document.createElement("span");
        username.textContent = name;

        tag.appendChild(avatar);
        tag.appendChild(username);
        playerList.appendChild(tag);
      });
    }

  } catch (error) {
    statusDot.className = "status-dot";
    serverStatus.textContent = "خطا در دریافت اطلاعات";
    console.error(error);
  }
}

loadServerStatus();
setInterval(loadServerStatus, 15000);

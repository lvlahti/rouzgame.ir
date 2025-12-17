// دنبال کردن موس برای چشم‌ها
document.addEventListener("mousemove", e => {
  document.querySelectorAll(".eye").forEach(eye => {
    const pupil = eye.querySelector("i");
    const rect = eye.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - y, e.clientX - x);
    const max = 4;
    pupil.style.transform =
      `translate(${Math.cos(angle) * max}px, ${Math.sin(angle) * max}px)`;
  });
});

// باران ابرها
const clouds = document.querySelectorAll(".cloud");
const rainIntervals = new Map();

clouds.forEach(cloud => {
  cloud.addEventListener("mouseenter", () => startRain(cloud));
  cloud.addEventListener("click", () => startRain(cloud)); // بارون با کلیک هم شروع شود
});

function startRain(cloud) {
  if (rainIntervals.has(cloud)) return; // اگر قبلاً بارون شروع شده بود

  const interval = setInterval(() => {
    const drop = document.createElement("div");
    drop.classList.add("raindrop");
    const cloudRect = cloud.getBoundingClientRect();
    drop.style.left = cloudRect.left + Math.random() * cloudRect.width + "px";
    drop.style.top = cloudRect.bottom + "px";
    document.body.appendChild(drop);
    setTimeout(() => drop.remove(), 1000);
  }, 100);

  rainIntervals.set(cloud, interval);
}

function stopRain(cloud) {
  // اگر موس از ابر رفت و کلیک نشده باشه بارون متوقف میشه
  if (rainIntervals.has(cloud)) {
    clearInterval(rainIntervals.get(cloud));
    rainIntervals.delete(cloud);
  }
}
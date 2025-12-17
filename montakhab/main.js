document.addEventListener("DOMContentLoaded", () => {

  // دنبال کردن موس برای مردمک چشم‌ها
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

  // درگ و دراپ ابر
  const clouds = document.querySelectorAll(".cloud");
  const initialPositions = new Map();
  let activeCloud = null;
  let offsetX = 0;
  let offsetY = 0;

  clouds.forEach(cloud => {
    const rect = cloud.getBoundingClientRect();
    initialPositions.set(cloud, { top: rect.top, left: rect.left });

    cloud.addEventListener("mousedown", e => {
      activeCloud = cloud;
      const rect = cloud.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      cloud.style.animation = "none";
      cloud.style.transition = "none";
    });
  });

  document.addEventListener("mousemove", e => {
    if (!activeCloud) return;
    activeCloud.style.left = (e.clientX - offsetX) + "px";
    activeCloud.style.top  = (e.clientY - offsetY) + "px";
  });

  document.addEventListener("mouseup", () => {
    if (!activeCloud) return;
    const init = initialPositions.get(activeCloud);
    activeCloud.style.transition = "left 0.5s ease, top 0.5s ease";
    activeCloud.style.left = init.left + "px";
    activeCloud.style.top  = init.top;
    activeCloud = null;
  });

  // پلک زدن رندوم جفتی برای هر ابر
  function blinkCloudsRandomly() {
    clouds.forEach(cloud => {
      if (Math.random() < 0.1) {
        const eyes = cloud.querySelectorAll(".eye");
        eyes.forEach(eye => eye.classList.add("blink"));
        setTimeout(() => eyes.forEach(eye => eye.classList.remove("blink")), 150);
      }
    });
  }

  setInterval(blinkCloudsRandomly, 500 + Math.random() * 1000);

});

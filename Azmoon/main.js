
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
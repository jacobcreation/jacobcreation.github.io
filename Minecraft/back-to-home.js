// Back to Home button for TurboWarp-packaged games
alert("Back to Home loaded");
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.createElement("button");
  btn.textContent = "🏠 Home";

  // Force visibility above TurboWarp canvas
  btn.style.position = "fixed";
  btn.style.top = "10px";
  btn.style.left = "10px";
  btn.style.zIndex = "999999";
  btn.style.padding = "10px 14px";
  btn.style.fontSize = "14px";
  btn.style.border = "none";
  btn.style.borderRadius = "6px";
  btn.style.cursor = "pointer";
  btn.style.background = "rgba(0,0,0,0.7)";
  btn.style.color = "white";

  btn.onmouseenter = () => btn.style.background = "rgba(0,0,0,0.9)";
  btn.onmouseleave = () => btn.style.background = "rgba(0,0,0,0.7)";

  // Change destination if needed
  btn.onclick = () => {
    window.location.href = "../index.html";
  };

  document.body.appendChild(btn);
});

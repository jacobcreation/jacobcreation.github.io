(function () {
  const hasViewportMeta = !!document.querySelector('meta[name="viewport"]');
  if (!hasViewportMeta) {
    const viewportMeta = document.createElement("meta");
    viewportMeta.name = "viewport";
    viewportMeta.content = "width=device-width, initial-scale=1, viewport-fit=cover";
    document.head.appendChild(viewportMeta);
  }

  if (!document.body || document.getElementById("jacob-project-dock")) {
    return;
  }

  const hasHeader = !!document.querySelector("header");
  const title = (document.title || "JacobCreation Project")
    .replace(/\s*-\s*JacobCreation\s*$/i, "")
    .trim();
  const subtitle =
    document.body.dataset.projectSubtitle ||
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content") ||
    "Custom-built by Jacob.";

  const style = document.createElement("style");
  style.textContent = `
    html, body {
      max-width: 100%;
      overflow-x: hidden;
      -webkit-text-size-adjust: 100%;
    }

    img, video, svg, iframe, canvas {
      max-width: 100%;
    }

    canvas {
      height: auto;
      touch-action: manipulation;
    }

    button, input, select, textarea {
      font: inherit;
      min-height: 44px;
    }

    #jacob-project-dock {
      position: fixed;
      z-index: 2147483000;
      color: #eaf2ff;
      font-family: "Poppins", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: none;
    }

    #jacob-project-dock *,
    #jacob-project-dock *::before,
    #jacob-project-dock *::after {
      box-sizing: border-box;
    }

    #jacob-project-dock a {
      color: inherit;
      text-decoration: none;
    }

    .jacob-project-glow {
      position: absolute;
      inset: -40px;
      pointer-events: none;
      filter: blur(30px);
      opacity: 0.55;
      background:
        radial-gradient(circle at top left, rgba(78, 161, 255, 0.45), transparent 40%),
        radial-gradient(circle at bottom right, rgba(255, 71, 87, 0.30), transparent 38%);
    }

    .jacob-project-card {
      position: relative;
      overflow: hidden;
      pointer-events: auto;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(10, 16, 32, 0.72);
      backdrop-filter: blur(14px);
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.34);
    }

    .jacob-project-dock-full {
      top: 16px;
      left: 16px;
      width: min(360px, calc(100vw - 32px));
      border-radius: 22px;
      padding: 16px;
    }

    .jacob-project-kicker {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 11px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(234, 242, 255, 0.82);
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .jacob-project-title {
      margin: 12px 0 6px;
      font-size: clamp(1.2rem, 2vw, 1.55rem);
      line-height: 1.08;
      font-weight: 800;
    }

    .jacob-project-copy {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.5;
      color: rgba(234, 242, 255, 0.76);
      max-width: 34ch;
    }

    .jacob-project-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
    }

    .jacob-project-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.08);
      font-size: 0.92rem;
      font-weight: 700;
      transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
    }

    .jacob-project-btn:hover,
    .jacob-project-btn:focus-visible {
      transform: translateY(-2px);
      background: rgba(255, 255, 255, 0.13);
      border-color: rgba(255, 255, 255, 0.24);
      outline: none;
    }

    .jacob-project-btn-primary {
      color: #071122;
      background: linear-gradient(135deg, rgba(78, 161, 255, 1), rgba(45, 107, 255, 1));
      border-color: rgba(90, 165, 255, 0.88);
      box-shadow: 0 10px 26px rgba(45, 107, 255, 0.28);
    }

    .jacob-project-dock-compact {
      right: 14px;
      bottom: 14px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
      width: min(320px, calc(100vw - 28px));
    }

    .jacob-project-dock-compact .jacob-project-card {
      border-radius: 999px;
      padding: 8px;
      display: flex;
      gap: 8px;
      align-items: center;
      margin-left: auto;
    }

    .jacob-project-dock-compact .jacob-project-btn {
      min-height: 40px;
      padding: 9px 13px;
      font-size: 0.88rem;
    }

    @media (max-width: 700px) {
      .jacob-project-dock-full {
        top: 12px;
        left: 12px;
        width: min(100vw - 24px, 330px);
        padding: 14px;
      }

      .jacob-project-title {
        font-size: 1.15rem;
      }

      .jacob-project-copy {
        font-size: 0.9rem;
      }

      .jacob-project-dock-compact {
        right: 10px;
        bottom: 10px;
        width: calc(100vw - 20px);
      }
    }
  `;
  document.head.appendChild(style);

  const fitWideCanvases = () => {
    const viewportWidth = window.innerWidth;
    document.querySelectorAll("canvas").forEach((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const naturalWidth = canvas.width || rect.width;
      if (!naturalWidth) {
        return;
      }

      const maxWidth = Math.max(220, viewportWidth - 24);
      if (naturalWidth > maxWidth) {
        canvas.style.width = `${maxWidth}px`;
        canvas.style.height = "auto";
      }
    });
  };

  fitWideCanvases();
  window.addEventListener("resize", fitWideCanvases, { passive: true });

  const dock = document.createElement("aside");
  dock.id = "jacob-project-dock";

  if (hasHeader) {
    dock.className = "jacob-project-dock-compact";
    dock.innerHTML = `
      <div class="jacob-project-card" aria-label="Quick navigation">
        <div class="jacob-project-glow" aria-hidden="true"></div>
        <a class="jacob-project-btn jacob-project-btn-primary" href="/">Home</a>
        <a class="jacob-project-btn" href="/#projects">Projects</a>
      </div>
    `;
  } else {
    dock.innerHTML = `
      <div class="jacob-project-card jacob-project-dock-full" aria-label="Project navigation">
        <div class="jacob-project-glow" aria-hidden="true"></div>
        <div class="jacob-project-kicker">JacobCreation Original</div>
        <h2 class="jacob-project-title">${title}</h2>
        <p class="jacob-project-copy">${subtitle}</p>
        <div class="jacob-project-actions">
          <a class="jacob-project-btn jacob-project-btn-primary" href="/">Home</a>
          <a class="jacob-project-btn" href="/#projects">More Projects</a>
        </div>
      </div>
    `;
  }

  document.body.appendChild(dock);
})();

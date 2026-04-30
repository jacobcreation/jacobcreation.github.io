(function () {
  const hasViewportMeta = !!document.querySelector('meta[name="viewport"]');
  if (!hasViewportMeta) {
    const viewportMeta = document.createElement("meta");
    viewportMeta.name = "viewport";
    viewportMeta.content = "width=device-width, initial-scale=1, viewport-fit=cover";
    document.head.appendChild(viewportMeta);
  }

  // 1. Inject CSS
  const style = document.createElement('style');
  style.textContent = `
    /* Google Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&display=swap');

    html, body {
      max-width: 100%;
      overflow-x: hidden;
      -webkit-text-size-adjust: 100%;
    }

    img, video, svg, iframe, canvas {
      max-width: 100%;
      height: auto;
    }

    #jacob-global-header {
      position: fixed; /* Fixed to stay on top */
      top: 0;
      left: 0;
      width: 100%;
      z-index: 2147483647; /* Max z-index */
      backdrop-filter: blur(10px);
      background: rgba(10, 16, 32, 0.65);
      border-bottom: 1px solid rgba(255, 255, 255, 0.10);
      font-family: "Poppins", sans-serif;
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      height: 68px;
    }

    #jacob-global-header * {
        box-sizing: border-box;
    }

    .jacob-header-container {
      width: 100%;
      max-width: 1100px;
      padding: 0 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      height: 100%;
    }

    .jacob-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      letter-spacing: 0.2px;
      font-size: 1.15rem;
      white-space: nowrap;
      text-decoration: none;
      color: #eaf2ff;
    }

    /* Badge */
    .jacob-logo-badge {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: linear-gradient(135deg, #1e90ff, #ff2d2d);
      box-shadow: 0 10px 24px rgba(30, 144, 255, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.20);
      font-weight: 900;
      color: white;
      font-family: "Poppins", sans-serif; /* Keep badge distinct */
      font-size: 20px;
    }

    /* Text Logo (Blue + Red gradient) */
    .jacob-logo-text {
      font-family: "Orbitron", sans-serif;
      font-weight: 800;
      font-size: 1.15rem;
      letter-spacing: 1px;
      background: linear-gradient(90deg, #1e90ff, #ff2d2d);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      text-shadow:
        0 0 14px rgba(30, 144, 255, 0.35),
        0 0 14px rgba(255, 45, 45, 0.25);
    }

    .jacob-nav {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .jacob-nav a {
      text-decoration: none;
      color: #eaf2ff;
      font-weight: 600;
      font-size: 0.92rem;
      padding: 9px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.06);
      transition: all 0.2s ease;
      white-space: nowrap;
      font-family: "Poppins", sans-serif;
    }

    .jacob-nav a:hover {
      transform: translateY(-2px);
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }

    /* Mobile Responsive */
    @media (max-width: 600px) {
      .jacob-header-container {
        padding: 0 12px;
      }

      .jacob-logo-text {
        font-size: 1rem;
      }

      .jacob-nav a {
        font-size: 0.85rem;
        padding: 7px 10px;
      }
    }

    @media (max-width: 480px) {
      #jacob-global-header {
        height: 58px;
      }

      .jacob-logo-badge {
        width: 32px;
        height: 32px;
        font-size: 17px;
      }

      .jacob-nav {
        gap: 6px;
      }

      .jacob-nav a {
        font-size: 0.78rem;
        padding: 6px 8px;
      }
    }
  `;
  document.head.appendChild(style);

  // 2. Inject HTML
  const header = document.createElement('header');
  header.id = "jacob-global-header";
  header.innerHTML = `
    <div class="jacob-header-container">
      <a href="/index.html" class="jacob-logo">
        <span class="jacob-logo-badge">J</span>
        <span class="jacob-logo-text">JacobCreation</span>
      </a>

      <nav class="jacob-nav">
        <a href="https://jacobcreation.github.io/about/">About</a>
        <a href="https://jacobcreation.github.io/downloads/">🎮 Play Offline</a>
        <a href="https://jacobcreation.github.io/releases/">🚀 Releases</a>
      </nav>
    </div>
  `;
  document.body.prepend(header);
})();

(function () {
  // 0. Ensure Viewport Meta Tag is set for mobile friendliness
  let viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    viewportMeta = document.createElement("meta");
    viewportMeta.name = "viewport";
    viewportMeta.content = "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5";
    document.head.appendChild(viewportMeta);
  } else if (!viewportMeta.content.includes("width=device-width")) {
    viewportMeta.content = "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5";
  }

  // 1. Inject Global CSS
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

    body {
      padding-top: 68px !important;
      box-sizing: border-box !important;
    }

    img, video, svg, iframe, canvas {
      max-width: 100%;
      height: auto;
    }

    button, input, select, textarea, .btn, .button, [role="button"] {
      font: inherit;
      min-height: 44px;
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
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.06);
      transition: all 0.2s ease;
      white-space: nowrap;
      font-family: "Poppins", sans-serif;
    }

    .jacob-nav a:hover, .jacob-nav a:focus {
      transform: translateY(-2px);
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
      outline: none;
    }

    .jacob-menu-toggle {
      display: none;
      background: none;
      border: none;
      color: #eaf2ff;
      font-size: 1.6rem;
      cursor: pointer;
      padding: 4px 8px;
      min-width: 44px;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .jacob-header-container {
        flex-wrap: wrap;
        padding: 10px 16px;
      }

      .jacob-menu-toggle {
        display: flex;
      }

      .jacob-nav {
        display: none;
        width: 100%;
        flex-direction: column;
        gap: 8px;
        padding-top: 10px;
      }

      .jacob-nav.active {
        display: flex;
      }

      .jacob-nav a {
        width: 100%;
        text-align: center;
        padding: 12px 16px;
        font-size: 1rem;
        border-radius: 12px;
      }

      #jacob-global-header {
        height: auto;
        min-height: 58px;
      }
      
      body {
        padding-top: 58px !important;
      }
    }
  `;
  document.head.appendChild(style);

  // 1b. Inject external Mobile Friendly CSS
  const mobileLink = document.createElement('link');
  mobileLink.rel = 'stylesheet';
  mobileLink.href = '/mobile-friendly.css?v=' + Date.now();
  document.head.appendChild(mobileLink);

  // 2. Inject HTML (Header)
  if (!document.getElementById('jacob-global-header')) {
    const header = document.createElement('header');
    header.id = "jacob-global-header";
    header.innerHTML = `
      <div class="jacob-header-container">
        <a href="/index.html" class="jacob-logo">
          <span class="jacob-logo-badge">J</span>
          <span class="jacob-logo-text">JacobCreation</span>
        </a>

        <button class="jacob-menu-toggle" id="jacobMobileMenuToggle" aria-label="Toggle navigation">
          ☰
        </button>

        <nav class="jacob-nav" id="jacobMainNav">
          <a href="/about/">About</a>
          <a href="/downloads/">🎮 Play Offline</a>
          <a href="/releases/">🚀 Releases</a>
        </nav>
      </div>
    `;
    document.body.prepend(header);

    // Setup Toggle Logic
    const menuToggle = document.getElementById('jacobMobileMenuToggle');
    const mainNav = document.getElementById('jacobMainNav');
    if (menuToggle && mainNav) {
      menuToggle.addEventListener('click', () => {
        mainNav.classList.toggle('active');
        if (mainNav.classList.contains('active')) {
          menuToggle.textContent = '✕';
          menuToggle.setAttribute('aria-expanded', 'true');
        } else {
          menuToggle.textContent = '☰';
          menuToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

})();

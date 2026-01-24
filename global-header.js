(function () {
    // 1. Inject CSS
    const style = document.createElement('style');
    style.textContent = `
    /* Header Styles from Main Site */
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

    #jacob-global-header {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 2147483647; /* Max z-index to overlay safely */
      backdrop-filter: blur(10px);
      background: rgba(10, 16, 32, 0.85);
      border-bottom: 1px solid rgba(255, 255, 255, 0.10);
      font-family: "Poppins", sans-serif;
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      height: 68px; /* Fixed height to prevent shifting if possible, or auto */
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

    .jacob-logo-badge {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(78, 161, 255, 0.95), rgba(45, 107, 255, 0.95));
      box-shadow: 0 10px 24px rgba(45, 107, 255, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.20);
      font-size: 20px;
    }

    .jacob-nav {
      display: flex;
      gap: 10px;
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
    }

    .jacob-nav a:hover {
      transform: translateY(-2px);
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }

    /* Mobile Responsive */
    @media (max-width: 600px) {
      .jacob-logo span {
        display: none;
      }
      .jacob-nav a {
        font-size: 0.85rem;
        padding: 8px 12px;
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
        <div class="jacob-logo-badge">🌟</div>
        <span>JacobCreation</span>
      </a>

      <nav class="jacob-nav">
        <a href="/index.html">🏠 Home</a>
        <a href="https://jacobcreation.github.io/downloads">🎮 Play Offline</a>
      </nav>
    </div>
  `;
    document.body.prepend(header);
})();

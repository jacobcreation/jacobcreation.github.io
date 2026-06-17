(function () {
  "use strict";

  const PAGE_BASE_URL = new URL(".", window.location.href);
  const LOCAL_V86_BASE = new URL("vendor/v86/", PAGE_BASE_URL).toString();

  const profiles = {

    "alpine": {
      label: "Alpine Linux",
      config: {
        bios: { url: `${LOCAL_V86_BASE}bios/seabios.bin` },
        vga_bios: { url: `${LOCAL_V86_BASE}bios/vgabios.bin` },
        cdrom: { url: `${LOCAL_V86_BASE}images/alpine/alpine-i686.iso`, size: 159383552, async: false },
        boot_order: 0x132,
      },
    },
  };

  const els = {
    boot: document.getElementById("bootButton"),
    pause: document.getElementById("pauseButton"),
    reset: document.getElementById("resetButton"),
    profile: document.getElementById("profileSelect"),
    memory: document.getElementById("memorySelect"),
    status: document.getElementById("statusText"),
    cpu: document.getElementById("cpuState"),
    memoryState: document.getElementById("memoryState"),
    kernel: document.getElementById("kernelInfo"),
    screen: document.getElementById("screenContainer"),
    vga: document.querySelector(".vga-text"),
    serial: document.getElementById("serialContainer"),
    prompt: document.getElementById("bootPrompt"),
    guidePanel: document.getElementById("guidePanel"),
    guideTitle: document.getElementById("guideTitle"),
    guideSummary: document.getElementById("guideSummary"),
    guideSteps: document.getElementById("guideSteps"),
    guideTip: document.getElementById("guideTip"),
    guideToggle: document.getElementById("guideToggle"),
  };

  const GUIDE_SCREENS = [
    {
      id: "cloud-init",
      match: /cloud-init|datasource|cidata|seed from|seedfrom/,
      title: "First boot setup",
      summary: "Ubuntu is reading the attached cloud-init seed and finishing one-time setup for this VM.",
      steps: [
        "Wait for cloud-init to finish before trying to log in.",
        "A short pause here is normal on the first boot.",
        "The next useful screen is usually the login prompt.",
      ],
      tip: "This only needs to happen once unless the disk image is replaced.",
    },
    {
      id: "login",
      match: /login:/,
      title: "Login prompt",
      summary: "The system is ready. Enter your username and password.",
      steps: [
        "Enter the appropriate username (e.g., root) and password (if set).",
        "Press Enter to get a shell prompt.",
      ],
      tip: "The password will not show on screen while you type it.",
    },
    {
      id: "shell",
      match: /ubuntu@ubuntu-browser-vm|ubuntu-browser-vm:~[$#]|last login|root@.*:~[#$]/,
      title: "Ubuntu shell ready",
      summary: "You are logged into the preinstalled Ubuntu system.",
      steps: [
        "Run `uname -a` to confirm the kernel and architecture.",
        "Run `ip a` to inspect network interfaces.",
        "Run `df -h` or `lsblk` to inspect the attached disk.",
      ],
      tip: "Because this is a cloud image, some services may settle for a moment after login.",
    },
    {
      id: "boot-menu",
      match: /gnu grub|grub version|booting from hard disk|ubuntu.*recovery mode/,
      title: "Boot menu",
      summary: "The VM is in the bootloader stage before Ubuntu proper starts.",
      steps: [
        "Use the default highlighted boot entry unless you are debugging.",
        "Press Enter to continue boot if GRUB is waiting for input.",
        "The next useful state is cloud-init or the login prompt.",
      ],
      tip: "If the menu pauses, Enter is usually enough to move forward.",
    },
    {
      id: "booting",
      match: /ubuntu 18\.04|loading initial ramdisk|starting version|kernel command line|systemd\[1\]|ext4-fs|iscsi:|mounted filesystem|raid6:|btrfs loaded/,
      title: "Booting Ubuntu system",
      summary: "Ubuntu is starting the already-installed system from the virtual hard disk.",
      steps: [
        "Wait for the kernel and services to finish starting.",
        "If this is the very first boot, cloud-init will run right after.",
        "You should end up at a text login prompt for the seeded account.",
      ],
      tip: "When login appears, use username `ubuntu` and password `ubuntu`.",
    },
  ];

  let emulator = null;
  let paused = false;
  let bootTimer = null;
  let isBooting = false;
  let guideInterval = null;
  let lastGuideId = "";

  async function profileBootCheck(profile) {
    const diskUrl = profile?.config?.hda?.url;

    if (!diskUrl) {
      return { ok: true };
    }

    try {
      const response = await fetch(diskUrl, {
        headers: {
          Range: "bytes=0-0",
          "X-Accept-Encoding": "identity",
        },
      });

      const contentRange = response.headers.get("Content-Range") || "";
      const acceptsRange = response.status === 206 && /bytes 0-0\/\d+/i.test(contentRange);

      if (acceptsRange) {
        return { ok: true };
      }
    } catch (error) {
      console.warn("Boot media range probe failed", error);
    }

    return {
      ok: false,
      message: "Ubuntu needs HTTP byte-range support for its disk image. Use `node server.js` locally or deploy to GitHub Pages, then reload and boot again.",
    };
  }

  function setStatus(message, state) {
    els.status.textContent = message;
    els.cpu.textContent = state || els.cpu.textContent;
  }

  function selectedMemoryMb() {
    const memory = Number.parseInt(els.memory.value, 10) || 512;
    return Math.max(512, memory);
  }

  function selectedProfile() {
    return profiles[els.profile.value] || profiles["alpine"];
  }

  function updateProfileText() {
    els.kernel.textContent = selectedProfile().label;
  }

  function renderGuide(guide) {
    if (!guide || guide.id === lastGuideId) {
      return;
    }

    lastGuideId = guide.id;
    els.guideTitle.textContent = guide.title;
    els.guideSummary.textContent = guide.summary;
    els.guideSteps.innerHTML = "";

    guide.steps.forEach((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      els.guideSteps.appendChild(item);
    });

    els.guideTip.textContent = guide.tip;
  }

  function renderServerWarning(message) {
    lastGuideId = "server-warning";
    els.guideTitle.textContent = "Server setup needed";
    els.guideSummary.textContent = message;
    els.guideSteps.innerHTML = "";

    [
      "Run `node server.js` from this project folder.",
      "Or deploy this folder to GitHub Pages under `/os/`.",
      "Open the served page again after that host is live.",
      "Boot Ubuntu again, then log in with username `ubuntu` and password `ubuntu`.",
    ].forEach((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      els.guideSteps.appendChild(item);
    });

    els.guideTip.textContent = "The VM disk needs byte-range reads, so root-assuming paths or simplistic static servers can make the boot look broken.";
  }

  function currentGuide() {
    const text = `${els.vga.innerText}\n${els.serial.textContent}`.toLowerCase();

    for (const guide of GUIDE_SCREENS) {
      if (guide.match.test(text)) {
        return guide;
      }
    }

    return {
      id: "booting",
      title: "Booting Ubuntu system",
      summary: "Ubuntu is booting from the preinstalled virtual disk. Early kernel messages can vary from boot to boot.",
      steps: [
        "Give the VM a moment to finish booting.",
        "Click inside the VM when you want keyboard focus.",
        "This panel will update automatically as Ubuntu reaches boot, cloud-init, and login states.",
      ],
      tip: "If login appears, use username `ubuntu` and password `ubuntu`.",
    };
  }

  function startGuideWatcher() {
    window.clearInterval(guideInterval);
    renderGuide(currentGuide());
    guideInterval = window.setInterval(() => {
      renderGuide(currentGuide());
    }, 700);
  }

  function stopEmulator() {
    window.clearTimeout(bootTimer);
    window.clearInterval(guideInterval);

    if (!emulator) {
      return;
    }

    try {
      emulator.stop();
      emulator.destroy();
    } catch (error) {
      console.warn("Could not fully stop emulator", error);
    }

    emulator = null;
  }

  async function boot() {
    const Starter = window.V86Starter || window.V86;
    const profile = selectedProfile();
    const memory = selectedMemoryMb();

    if (isBooting) {
      return;
    }

    isBooting = true;
    stopEmulator();
    paused = false;
    els.vga.textContent = "";
    els.serial.textContent = "";
    els.prompt.hidden = true;
    els.memory.value = String(memory);
    els.memoryState.textContent = `${memory} MB RAM`;
    els.pause.textContent = "Pause";
    els.boot.disabled = true;
    els.memory.disabled = true;
    els.profile.disabled = true;
    els.pause.disabled = true;
    els.reset.disabled = true;
    setStatus(`Booting ${profile.label}...`, "booting");

    if (!Starter) {
      isBooting = false;
      els.boot.disabled = false;
      els.memory.disabled = false;
      els.profile.disabled = false;
      setStatus("v86 failed to load. Check that vendor/v86/build/libv86.js is present.", "error");
      return;
    }

    const bootCheck = await profileBootCheck(profile);
    if (!bootCheck.ok) {
      isBooting = false;
      els.boot.disabled = false;
      els.memory.disabled = false;
      els.profile.disabled = false;
      els.prompt.hidden = false;
      setStatus(bootCheck.message, "error");
      renderServerWarning(bootCheck.message);
      return;
    }

    try {
      emulator = new Starter({
        wasm_path: `${LOCAL_V86_BASE}build/v86.wasm`,
        memory_size: memory * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        screen_container: els.screen,
        serial_container: els.serial,
        autostart: true,
        disable_keyboard: false,
        disable_mouse: false,
        ...profile.config,
      });

      emulator.add_listener("emulator-ready", () => {
        window.clearTimeout(bootTimer);
        isBooting = false;
        els.boot.disabled = false;
        els.memory.disabled = false;
        els.profile.disabled = false;
        els.pause.disabled = false;
        els.reset.disabled = false;
        setStatus(`${profile.label} is running. Click the terminal and type.`, "running");
        startGuideWatcher();
      });

      emulator.add_listener("emulator-stopped", () => {
        isBooting = false;
        els.pause.disabled = true;
        els.memory.disabled = false;
        els.profile.disabled = false;
        setStatus("Virtual machine stopped.", "stopped");
      });

      bootTimer = window.setTimeout(() => {
        if (!emulator) {
          return;
        }

        setStatus("Ubuntu VM is still loading local boot media...", "booting");
      }, 6500);
    } catch (error) {
      console.error(error);
      isBooting = false;
      els.boot.disabled = false;
      els.memory.disabled = false;
      els.profile.disabled = false;
      setStatus("Ubuntu VM failed to start. Check the browser console for v86 details.", "error");
    }
  }

  function togglePause() {
    if (!emulator) {
      return;
    }

    if (paused) {
      emulator.run();
      paused = false;
      els.pause.textContent = "Pause";
      setStatus("Virtual machine resumed.", "running");
    } else {
      emulator.stop();
      paused = true;
      els.pause.textContent = "Resume";
      setStatus("Virtual machine paused.", "paused");
    }
  }

  function reset() {
    if (isBooting) {
      return;
    }

    if (!emulator) {
      boot();
      return;
    }

    setStatus("Rebooting Ubuntu VM from local media...", "resetting");
    stopEmulator();
    boot();
  }

  els.boot.addEventListener("click", boot);
  els.pause.addEventListener("click", togglePause);
  els.reset.addEventListener("click", reset);
  els.profile.addEventListener("change", updateProfileText);
  els.guideToggle.addEventListener("click", () => {
    const collapsed = els.guidePanel.classList.toggle("is-collapsed");
    els.guideToggle.textContent = collapsed ? "Show" : "Hide";
    els.guideToggle.setAttribute("aria-expanded", String(!collapsed));
  });

  updateProfileText();
  renderGuide(currentGuide());
})();

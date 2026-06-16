(function () {
  "use strict";

  const LOCAL_V86_BASE = "./vendor/v86/";

  const profiles = {
    ubuntu: {
      label: "Ubuntu Server 18.04 netboot installer",
      config: {
        bios: { url: `${LOCAL_V86_BASE}bios/seabios.bin` },
        vga_bios: { url: `${LOCAL_V86_BASE}bios/vgabios.bin` },
        bzimage: { url: `${LOCAL_V86_BASE}images/ubuntu-server/linux`, size: 7517600, async: false },
        initrd: { url: `${LOCAL_V86_BASE}images/ubuntu-server/initrd.gz`, size: 44407980, async: false },
        cmdline: "initrd=initrd.gz priority=low debian-installer/framebuffer=false fb=false BOOT_DEBUG=2 locale=en_US console-setup/ask_detect=false keyboard-configuration/layoutcode=us",
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
  };

  let emulator = null;
  let paused = false;
  let bootTimer = null;
  let isBooting = false;

  function setStatus(message, state) {
    els.status.textContent = message;
    els.cpu.textContent = state || els.cpu.textContent;
  }

  function selectedMemoryMb() {
    const memory = Number.parseInt(els.memory.value, 10) || 512;
    return Math.max(512, memory);
  }

  function selectedProfile() {
    return profiles[els.profile.value] || profiles.ubuntu;
  }

  function updateProfileText() {
    els.kernel.textContent = selectedProfile().label;
  }

  function stopEmulator() {
    window.clearTimeout(bootTimer);

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

  function boot() {
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

  updateProfileText();
})();

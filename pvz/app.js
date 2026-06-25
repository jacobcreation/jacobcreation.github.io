    const appElement = document.getElementById('app');
    const launchScreen = document.getElementById('launch');
    const loadingScreen = document.getElementById('loading');
    const loadingInner = document.getElementById('loading-inner');
    const errorScreen = document.getElementById('error');
    const errorScreenMessage = document.getElementById('error-message');
    const errorScreenStack = document.getElementById('error-stack');

    const handleError = (error) => {
      console.error(error);
      if (!errorScreen.hidden) return;
      errorScreen.hidden = false;
      errorScreenMessage.textContent = '' + error;
      let debug = error && error.stack || 'no stack';
      debug += '\nUser agent: ' + navigator.userAgent;
      errorScreenStack.textContent = debug;
    };
    const setProgress = (progress) => {
      if (loadingInner) loadingInner.style.width = progress * 100 + '%';
    };
    const interpolate = (a, b, t) => a + t * (b - a);

    try {
      setProgress(0.1);

      const scaffolding = new Scaffolding.Scaffolding();
      scaffolding.width = 480;
      scaffolding.height = 360;
      scaffolding.resizeMode = "preserve-ratio";
      scaffolding.editableLists = false;
      scaffolding.usePackagedRuntime = true;
      scaffolding.setup();
      scaffolding.appendTo(appElement);

      const vm = scaffolding.vm;
      window.scaffolding = scaffolding;
      window.vm = scaffolding.vm;
      window.Scratch = {
        vm,
        renderer: vm.renderer,
        audioEngine: vm.runtime.audioEngine,
        bitmapAdapter: vm.runtime.v2BitmapAdapter,
        videoProvider: vm.runtime.ioDevices.video.provider
      };

      scaffolding.setUsername("player####".replace(/#/g, () => Math.floor(Math.random() * 10)));
      scaffolding.setAccentColor("#ff4c4c");

      try {
        scaffolding.addCloudProvider(new Scaffolding.Cloud.WebSocketProvider(["wss://clouddata.turbowarp.org","wss://clouddata.turbowarp.xyz"], "1034694842"));
      } catch (error) {
        console.error(error);
      }

      vm.setTurboMode(false);
      if (vm.setInterpolation) vm.setInterpolation(true);
      if (vm.setFramerate) vm.setFramerate(30);
      if (vm.renderer.setUseHighQualityRender) vm.renderer.setUseHighQualityRender(false);
      if (vm.setRuntimeOptions) vm.setRuntimeOptions({
        fencing: true,
        miscLimits: false,
        maxClones: 9999999999,
      });
      if (vm.setCompilerOptions) vm.setCompilerOptions({
        enabled: true,
        warpTimer: false
      });
      if (vm.renderer.setMaxTextureDimension) vm.renderer.setMaxTextureDimension(2048);

      // enforcePrivacy threat model only makes sense in the editor
      if (vm.runtime.setEnforcePrivacy) vm.runtime.setEnforcePrivacy(false);

      if (typeof ScaffoldingAddons !== 'undefined') {
        ScaffoldingAddons.run(scaffolding, {"gamepad":false,"pointerlock":false,"specialCloudBehaviors":false,"unsafeCloudBehaviors":false,"pause":false});
      }

      scaffolding.setExtensionSecurityManager({
        getSandboxMode: () => 'unsandboxed',
        canLoadExtensionFromProject: () => true
      });
      for (const extension of []) {
        vm.extensionManager.loadExtensionURL(extension);
      }

    } catch (e) {
      handleError(e);
    }

;

      const getProjectData = (function() {
        const storage = scaffolding.storage;
        storage.onprogress = (total, loaded) => {
          setProgress(interpolate(0.2, 0.98, loaded / total));
        };
        
        storage.addWebStore(
          [
            storage.AssetType.ImageVector,
            storage.AssetType.ImageBitmap,
            storage.AssetType.Sound,
            storage.AssetType.Font
          ].filter(i => i),
          (asset) => new URL('./assets/' + asset.assetId + '.' + asset.dataFormat, location).href
        );
        return () => new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          resolve(xhr.response);
        };
        xhr.onerror = () => {
          if (location.protocol === 'file:') {
            reject(new Error('Zip environment must be used on a website, not on a local file. To fix this error, use the "Plain HTML" environment instead.'));
          } else {
            reject(new Error('Request to load project data failed.'));
          }
        };
        xhr.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(interpolate(0.1, 0.2, e.loaded / e.total));
          }
        };
        xhr.responseType = 'arraybuffer';
        xhr.open('GET', "./assets/project.json");
        xhr.send();
      });
      })();

;

    const run = async () => {
      const projectData = await getProjectData();
      await scaffolding.loadProject(projectData);
      setProgress(1);
      loadingScreen.hidden = true;
      if (false) {
        scaffolding.start();
      } else {
        launchScreen.hidden = false;
        launchScreen.addEventListener('click', () => {
          launchScreen.hidden = true;
          scaffolding.start();
        });
        launchScreen.focus();
      }
    };
    run().catch(handleError);

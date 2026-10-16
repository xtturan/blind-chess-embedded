(() => {
  const VIBE_ON_SCALE = 1.0;
  const VIBE_PWM_NORMAL = 120;

  const LOG_COLORS = {
    WS: '#22c55e',
    BTN: '#3b82f6',
    MTR: '#f59e0b',
    ENG: '#a855f7',
    GAME: '#06b6d4'
  };

  const DEFAULT_SETTINGS = {
    useMotorVibrate: true,
    usePhoneVibrate: false,
    keepAwake: true,
    freq: 1,
    pwmScale: 0.7,
    motorOnScale: 0.8,
    motorMinOffMs: 150,
    motorMinOnMs: 40,
    clickMs: 85,
    clickPwm: 120,
    confirmMs: 120,
    confirmPwm: 120,
    thinkingMs: 100,
    thinkingPwm: 120,
    illegalBuzzMs: 400,
    illegalBuzzPwm: 120,
    idleCancelMs: 2000,
    idleResetMs: 5000,
    idleReplayMs: 10000,
    engineRepeatIntervalMs: 10000,
    engineRepeatInitialDelayMs: 3000,
    engineDepth: 0,
    openingTimeMs: 20000,
    middlegameTimeMs: 20000,
    endgameTimeMs: 20000,
    skill: 20,
    threads: 6,
    hash: 256,
    autoHash: false,
    uciElo: 3500,
    boostEnabled: false,
    boostDepth: 0,
    boostOpeningTimeMs: 30000,
    boostMiddlegameTimeMs: 30000,
    boostEndgameTimeMs: 30000,
    boostThreads: 6,
    boostHash: 512,
    boostUciElo: 3500
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem('blindchess_settings');
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem('blindchess_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }

  let settings = loadSettings();

  function buildPatterns() {
    return {
      CLICK: { pattern: [settings.clickMs], pwm: VIBE_PWM_NORMAL },
      CONFIRM: { pattern: [settings.confirmMs], pwm: VIBE_PWM_NORMAL },
      ERROR: { pattern: [100, 100, 100, 100, 100], pwm: VIBE_PWM_NORMAL },
      GO_BACK: { pattern: [70, 100], pwm: VIBE_PWM_NORMAL },
      THINKING_PULSE: { pattern: [20], pwm: VIBE_PWM_NORMAL },
      CHECK: { pattern: [140, 100, 140, 100, 140], pwm: VIBE_PWM_NORMAL },
      WIN: { pattern: [100, 70, 100, 70, 100, 70, 100, 140, 210], pwm: VIBE_PWM_NORMAL },
      LOSE: { pattern: [280, 140, 280, 140, 280], pwm: VIBE_PWM_NORMAL },
      TIMEOUT: { pattern: [800, 300, 800], pwm: VIBE_PWM_NORMAL },
      ILLEGAL: { pattern: [1200], pwm: VIBE_PWM_NORMAL },
      ALERT: { pattern: [600, 200, 600], pwm: VIBE_PWM_NORMAL }
    };
  }

  let PATTERNS = buildPatterns();

  const STATE = {
    IDLE: 'IDLE',
    COLOR_SELECT: 'COLOR_SELECT',
    FROM_FILE: 'FROM_FILE',
    FROM_RANK: 'FROM_RANK',
    TO_FILE: 'TO_FILE',
    TO_RANK: 'TO_RANK',
    PROMOTION: 'PROMOTION',
    WAITING_ENGINE: 'WAITING_ENGINE',
    ENGINE_MOVE: 'ENGINE_MOVE'
  };

  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  const statusText = document.getElementById('statusText');
  const wsStatus = document.getElementById('wsStatus');
  const turnText = document.getElementById('turnText');
  const selectionText = document.getElementById('selectionText');
  const tapCountText = document.getElementById('tapCountText');
  const debugPanel = document.getElementById('debugPanel');
  const testMotorBtn = document.getElementById('testMotor');
  const forceReconnectBtn = document.getElementById('forceReconnect');
  const boardEl = document.getElementById('board');
  const movesListEl = document.getElementById('movesList');
  const copyMovesBtn = document.getElementById('copyMoves');
  const movesInput = document.getElementById('movesInput');
  const applyMovesBtn = document.getElementById('applyMoves');
  const clearMovesBtn = document.getElementById('clearMoves');
  const manualMoveInput = document.getElementById('manualMoveInput');
  const submitManualMoveBtn = document.getElementById('submitManualMove');
  const adminToggleBtn = document.getElementById('toggleAdmin');
  const adminPanel = document.getElementById('adminPanel');
  const adminSaveBtn = document.getElementById('adminSave');
  const adminResetBtn = document.getElementById('adminReset');
  const adminExportBtn = document.getElementById('adminExport');
  const adminImportBtn = document.getElementById('adminImport');
  const adminJson = document.getElementById('adminJson');

  const toggleBenchmarkBtn = document.getElementById('toggleBenchmark');
  const benchmarkPanel = document.getElementById('benchmarkPanel');
  const benchmarkTimeInput = document.getElementById('benchmarkTime');
  const benchmarkThreadsInput = document.getElementById('benchmarkThreads');
  const startBenchmarkBtn = document.getElementById('startBenchmark');
  const benchmarkResults = document.getElementById('benchmarkResults');
  const resDepth = document.getElementById('resDepth');
  const resNodes = document.getElementById('resNodes');
  const resNps = document.getElementById('resNps');
  const resTime = document.getElementById('resTime');

  const settingUseMotor = document.getElementById('settingUseMotor');
  const settingUsePhone = document.getElementById('settingUsePhone');
  const settingKeepAwake = document.getElementById('settingKeepAwake');
  const settingFreq = document.getElementById('settingFreq');
  const settingPwmScale = document.getElementById('settingPwmScale');
  const settingMotorOnScale = document.getElementById('settingMotorOnScale');
  const settingMotorMinOff = document.getElementById('settingMotorMinOff');
  const settingMotorMinOn = document.getElementById('settingMotorMinOn');
  const settingClickMs = document.getElementById('settingClickMs');
  const settingConfirmMs = document.getElementById('settingConfirmMs');
  const settingThinkingMs = document.getElementById('settingThinkingMs');
  const settingIllegalMs = document.getElementById('settingIllegalMs');
  const settingIllegalPwm = document.getElementById('settingIllegalPwm');
  const settingIdleCancel = document.getElementById('settingIdleCancel');
  const settingIdleReset = document.getElementById('settingIdleReset');
  const settingIdleReplay = document.getElementById('settingIdleReplay');
  const settingDepth = document.getElementById('settingDepth');
  const settingOpening = document.getElementById('settingOpening');
  const settingMiddle = document.getElementById('settingMiddle');
  const settingEndgame = document.getElementById('settingEndgame');
  const settingRepeatInterval = document.getElementById('settingRepeatInterval');
  const settingRepeatDelay = document.getElementById('settingRepeatDelay');
  const settingSkill = document.getElementById('settingSkill');
  const settingThreads = document.getElementById('settingThreads');
  const settingHash = document.getElementById('settingHash');
  const settingAutoHash = document.getElementById('settingAutoHash');
  const settingElo = document.getElementById('settingElo');
  const settingBoost = document.getElementById('settingBoost');
  const settingBoostDepth = document.getElementById('settingBoostDepth');
  const settingBoostOpening = document.getElementById('settingBoostOpening');
  const settingBoostMiddle = document.getElementById('settingBoostMiddle');
  const settingBoostEndgame = document.getElementById('settingBoostEndgame');
  const settingBoostThreads = document.getElementById('settingBoostThreads');
  const settingBoostHash = document.getElementById('settingBoostHash');
  const settingBoostElo = document.getElementById('settingBoostElo');

  let ws = null;
  let connected = false;
  let gameState = STATE.IDLE;
  let selection = 0;
  let tapCount = 0;
  let playerColor = 'w';
  let turn = 'w';
  let board = initializeBoard();
  let castling = 'KQkq';
  let enPassant = null;
  let halfmove = 0;
  let fullmove = 1;
  let fromFile = 0;
  let fromRank = 0;
  let toFile = 0;
  let toRank = 0;
  let pendingPromotionSquare = null;
  let pendingPromotionColor = 'w';
  let lastEngineMove = null;
  let moveHistory = [];
  let engineRepeatTimer = null;
  let engineRepeatActive = false;
  let thinkingTimer = null;
  let lastInputTime = Date.now();
  let ignoreButtonsUntil = 0;
  let lastIdleCancelAt = 0;
  let lastIdleResetAt = 0;
  let lastIdleReplayAt = 0;
  let vibrationUnlocked = false;
  let engineThinkTimeout = null;
  let lastInfoBestMove = null;
  let engineTimeoutFallback = null;
  let wakeLock = null;
  let keepAwakeVideo = null;
  let keepAwakeTimer = null;
  let wsReconnectTimer = null;
  let wsReconnectDelay = 1000;
  const WS_MAX_RECONNECT_DELAY = 10000;
  let wsPingInterval = null;

  let benchmarkActive = false;
  let benchmarkStartTime = 0;

  let engineWorker = null;

  function initEngine() {
    if (engineWorker) {
      engineWorker.terminate();
    }
    engineWorker = new Worker('/stockfish.wasm.js');
    engineWorker.onmessage = (e) => {
      const line = e.data;
      
      // Force engine to actually use the requested time for deeper search
      // (Unless it's a benchmark)
      if (!benchmarkActive && line.startsWith('bestmove')) {
        const timeSpent = Date.now() - engineMoveStartTime;
        const minTime = getAdaptiveMoveTime() * 0.9; // Aim for 90% of allocated time
        if (timeSpent < minTime) {
          addLog('ENG', `Found move too fast (${timeSpent}ms), holding for depth...`);
          // Note: In a real worker we can't easily "hold", but Stockfish 16 
          // usually ignores movetime if it finds a mate.
        }
      }

      if (benchmarkActive && typeof line === 'string' && line.startsWith('info')) {
        const depthMatch = line.match(/depth (\d+)/);
        const nodesMatch = line.match(/nodes (\d+)/);
        const npsMatch = line.match(/nps (\d+)/);
        const timeMatch = line.match(/time (\d+)/);

        if (depthMatch) resDepth.innerText = depthMatch[1];
        if (nodesMatch) resNodes.innerText = Number(nodesMatch[1]).toLocaleString();
        if (npsMatch) resNps.innerText = Number(npsMatch[1]).toLocaleString();
        if (timeMatch) resTime.innerText = timeMatch[1];
      }

      if (typeof line === 'string' && line.startsWith('bestmove')) {
        if (benchmarkActive) {
          benchmarkActive = false;
          startBenchmarkBtn.disabled = false;
          startBenchmarkBtn.innerText = 'Start Benchmark';
          applyEngineOptions(); // Restore options
          addLog('ENG', 'Benchmark finished');
          return;
        }
      }

      if (typeof line === 'string' && line.startsWith('info')) {
        const pvIndex = line.indexOf(' pv ');
        if (pvIndex !== -1) {
          const pv = line.slice(pvIndex + 4).trim();
          const firstMove = pv.split(' ')[0];
          if (firstMove && firstMove.length >= 4) {
            lastInfoBestMove = firstMove.slice(0, 4);
          }
        }
      }
      if (typeof line === 'string' && line.startsWith('bestmove')) {
        const move = line.split(' ')[1];
        if (engineThinkTimeout) {
          clearTimeout(engineThinkTimeout);
          engineThinkTimeout = null;
        }
        if (engineTimeoutFallback) {
          clearTimeout(engineTimeoutFallback);
          engineTimeoutFallback = null;
        }
        addLog('ENG', `Best move: ${move}`);
        stopThinkingPulse();
        handleEngineMove(move);
      }
    };
    engineWorker.postMessage('uci');
    engineWorker.postMessage('isready');
    applyEngineOptions();
  }

  initEngine();

  function applyEngineOptions() {
    const effectiveThreads = settings.boostEnabled ? settings.boostThreads : settings.threads;
    const effectiveHash = getEffectiveHash(effectiveThreads);
    const effectiveElo = settings.boostEnabled ? settings.boostUciElo : settings.uciElo;
    engineWorker.postMessage('setoption name Skill Level value 20');
    engineWorker.postMessage(`setoption name Threads value ${effectiveThreads}`);
    engineWorker.postMessage(`setoption name Hash value ${effectiveHash}`);
    engineWorker.postMessage('setoption name UCI_LimitStrength value false');
    engineWorker.postMessage('setoption name Use NNUE value true'); // CRITICAL for modern strength
    engineWorker.postMessage('setoption name MultiPV value 1');
    engineWorker.postMessage('setoption name Ponder value false');
    engineWorker.postMessage('setoption name Slow Mover value 100');
    engineWorker.postMessage('setoption name Move Overhead value 100'); // Reduced for tighter timing
    engineWorker.postMessage('setoption name Analysis Contempt value White'); // Modern alternative to Contempt
  }

  function getEffectiveHash(effectiveThreads) {
    if (!settings.autoHash) {
      return settings.boostEnabled ? settings.boostHash : settings.hash;
    }
    const moveTime = getAdaptiveMoveTime();
    let baseHash = 64;
    if (moveTime <= 5000) {
      baseHash = 64;
    } else if (moveTime <= 15000) {
      baseHash = 128;
    } else if (moveTime <= 30000) {
      baseHash = 192;
    } else {
      baseHash = 256;
    }
    const scaled = baseHash * Math.max(1, Math.floor(effectiveThreads || 1));
    return Math.min(256, Math.max(16, scaled));
  }

  function connectWS() {
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }

    if (ws) {
      // Remove previous listeners to avoid ghost connections
      try {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
      } catch (e) {}
    }

    const host = window.location.hostname || '192.168.4.1';
    addLog('WS', `Connecting to ${host}...`);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${host}:81`);

    ws.onopen = () => {
      connected = true;
      wsReconnectDelay = 1000; // Reset delay on success
      updateUI();
      addLog('WS', 'Connected');
      
      // Start heartbeat
      if (wsPingInterval) clearInterval(wsPingInterval);
      wsPingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 5000);
    };

    ws.onclose = (event) => {
      if (wsPingInterval) {
        clearInterval(wsPingInterval);
        wsPingInterval = null;
      }
      if (connected) {
        connected = false;
        updateUI();
        addLog('WS', `Disconnected (code: ${event.code})`);
      } else {
        addLog('WS', `Failed to connect (code: ${event.code})`);
      }
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      addLog('WS', 'Connection error');
      if (ws) ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'button') {
          addLog('BTN', msg.action);
          handleButton(msg.action);
        } else if (msg.type === 'status') {
          addLog('WS', 'Status received');
        } else if (msg.type === 'pong') {
          addLog('WS', 'Pong');
        }
      } catch (err) {
        addLog('WS', 'Invalid message');
      }
    };
  }

  function scheduleReconnect() {
    if (wsReconnectTimer) return;
    
    addLog('WS', `Reconnecting in ${wsReconnectDelay}ms...`);
    wsReconnectTimer = setTimeout(() => {
      wsReconnectTimer = null;
      connectWS();
      // Exponential backoff
      wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, WS_MAX_RECONNECT_DELAY);
    }, wsReconnectDelay);
  }

  function forceReconnect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'reset' }));
      } catch {
        // ignore
      }
    }
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    connectWS();
  }

  function unlockVibration() {
    if (vibrationUnlocked) return;
    if (!settings.usePhoneVibrate) {
      vibrationUnlocked = true;
      return;
    }
    if (navigator.vibrate) {
      navigator.vibrate(1);
      vibrationUnlocked = true;
      addLog('MTR', 'Vibration unlocked');
    }
  }

  async function requestWakeLock() {
    if (!settings.keepAwake) return;
    if (!('wakeLock' in navigator)) return;
    if (document.visibilityState !== 'visible') return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch {
      // ignore
    }
  }

  function startKeepAwakeVideo() {
    if (!settings.keepAwake || keepAwakeVideo) return;
    if (!('captureStream' in HTMLCanvasElement.prototype)) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 1, 1);
    }
    const stream = canvas.captureStream(1);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.srcObject = stream;
    video.play().catch(() => {});
    keepAwakeVideo = video;
  }

  function stopKeepAwakeVideo() {
    if (!keepAwakeVideo) return;
    try {
      keepAwakeVideo.pause();
    } catch {
      // ignore
    }
    keepAwakeVideo = null;
  }

  function applyKeepAwake() {
    if (!settings.keepAwake) {
      if (wakeLock) {
        wakeLock.release?.().catch(() => {});
        wakeLock = null;
      }
      stopKeepAwakeVideo();
      if (keepAwakeTimer) {
        clearInterval(keepAwakeTimer);
        keepAwakeTimer = null;
      }
      return;
    }

    requestWakeLock();
    startKeepAwakeVideo();
    if (!keepAwakeTimer) {
      keepAwakeTimer = setInterval(() => {
        requestWakeLock();
        if (!wakeLock) startKeepAwakeVideo();
      }, 20000);
    }
  }

  document.addEventListener('touchstart', () => {
    unlockVibration();
    requestWakeLock();
    startKeepAwakeVideo();
  }, { passive: true, once: true });
  document.addEventListener('click', () => {
    unlockVibration();
    requestWakeLock();
    startKeepAwakeVideo();
  }, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      startKeepAwakeVideo();
    }
  });
  unlockVibration();

  function applySettings(nextSettings, shouldSave = true) {
    settings = { ...settings, ...nextSettings };
    PATTERNS = buildPatterns();
    if (!settings.usePhoneVibrate) {
      vibrationUnlocked = true;
    } else {
      vibrationUnlocked = false;
    }
    applyEngineOptions();
    applyKeepAwake();
    if (shouldSave) saveSettings();
    updateUI();
  }

  function getNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function readSettingsForm() {
    return {
      useMotorVibrate: settingUseMotor?.checked ?? settings.useMotorVibrate,
      usePhoneVibrate: settingUsePhone?.checked ?? settings.usePhoneVibrate,
      keepAwake: settingKeepAwake?.checked ?? settings.keepAwake,
      freq: getNumber(settingFreq?.value, settings.freq),
      pwmScale: getNumber(settingPwmScale?.value, settings.pwmScale),
      motorOnScale: getNumber(settingMotorOnScale?.value, settings.motorOnScale),
      motorMinOffMs: getNumber(settingMotorMinOff?.value, settings.motorMinOffMs),
      motorMinOnMs: getNumber(settingMotorMinOn?.value, settings.motorMinOnMs),
      clickMs: getNumber(settingClickMs?.value, settings.clickMs),
      confirmMs: getNumber(settingConfirmMs?.value, settings.confirmMs),
      thinkingMs: getNumber(settingThinkingMs?.value, settings.thinkingMs),
      illegalBuzzMs: getNumber(settingIllegalMs?.value, settings.illegalBuzzMs),
      illegalBuzzPwm: getNumber(settingIllegalPwm?.value, settings.illegalBuzzPwm),
      idleCancelMs: getNumber(settingIdleCancel?.value, settings.idleCancelMs),
      idleResetMs: getNumber(settingIdleReset?.value, settings.idleResetMs),
      idleReplayMs: getNumber(settingIdleReplay?.value, settings.idleReplayMs),
      engineDepth: getNumber(settingDepth?.value, settings.engineDepth),
      openingTimeMs: getNumber(settingOpening?.value, settings.openingTimeMs),
      middlegameTimeMs: getNumber(settingMiddle?.value, settings.middlegameTimeMs),
      endgameTimeMs: getNumber(settingEndgame?.value, settings.endgameTimeMs),
      engineRepeatIntervalMs: getNumber(settingRepeatInterval?.value, settings.engineRepeatIntervalMs),
      engineRepeatInitialDelayMs: getNumber(settingRepeatDelay?.value, settings.engineRepeatInitialDelayMs),
      skill: getNumber(settingSkill?.value, settings.skill),
      threads: getNumber(settingThreads?.value, settings.threads),
      hash: getNumber(settingHash?.value, settings.hash),
      autoHash: settingAutoHash?.checked ?? settings.autoHash,
      uciElo: getNumber(settingElo?.value, settings.uciElo),
      boostEnabled: settingBoost?.checked ?? settings.boostEnabled,
      boostDepth: getNumber(settingBoostDepth?.value, settings.boostDepth),
      boostOpeningTimeMs: getNumber(settingBoostOpening?.value, settings.boostOpeningTimeMs),
      boostMiddlegameTimeMs: getNumber(settingBoostMiddle?.value, settings.boostMiddlegameTimeMs),
      boostEndgameTimeMs: getNumber(settingBoostEndgame?.value, settings.boostEndgameTimeMs),
      boostThreads: getNumber(settingBoostThreads?.value, settings.boostThreads),
      boostHash: getNumber(settingBoostHash?.value, settings.boostHash),
      boostUciElo: getNumber(settingBoostElo?.value, settings.boostUciElo)
    };
  }

  function syncSettingsForm() {
    if (!settingUseMotor) return;
    settingUseMotor.checked = settings.useMotorVibrate;
    settingUsePhone.checked = settings.usePhoneVibrate;
    settingKeepAwake.checked = settings.keepAwake;
    settingFreq.value = settings.freq;
    settingPwmScale.value = settings.pwmScale;
    settingMotorOnScale.value = settings.motorOnScale;
    settingMotorMinOff.value = settings.motorMinOffMs;
    settingMotorMinOn.value = settings.motorMinOnMs;
    settingClickMs.value = settings.clickMs;
    settingConfirmMs.value = settings.confirmMs;
    settingThinkingMs.value = settings.thinkingMs;
    settingIllegalMs.value = settings.illegalBuzzMs;
    settingIllegalPwm.value = settings.illegalBuzzPwm;
    settingIdleCancel.value = settings.idleCancelMs;
    settingIdleReset.value = settings.idleResetMs;
    settingIdleReplay.value = settings.idleReplayMs;
    settingDepth.value = settings.engineDepth;
    settingOpening.value = settings.openingTimeMs;
    settingMiddle.value = settings.middlegameTimeMs;
    settingEndgame.value = settings.endgameTimeMs;
    settingRepeatInterval.value = settings.engineRepeatIntervalMs;
    settingRepeatDelay.value = settings.engineRepeatInitialDelayMs;
    settingSkill.value = settings.skill;
    settingThreads.value = settings.threads;
    settingHash.value = settings.hash;
    settingAutoHash.checked = settings.autoHash;
    settingElo.value = settings.uciElo;
    settingBoost.checked = settings.boostEnabled;
    settingBoostDepth.value = settings.boostDepth;
    settingBoostOpening.value = settings.boostOpeningTimeMs;
    settingBoostMiddle.value = settings.boostMiddlegameTimeMs;
    settingBoostEndgame.value = settings.boostEndgameTimeMs;
    settingBoostThreads.value = settings.boostThreads;
    settingBoostHash.value = settings.boostHash;
    settingBoostElo.value = settings.boostUciElo;
  }

  if (adminToggleBtn && adminPanel) {
    adminToggleBtn.addEventListener('click', () => {
      adminPanel.classList.toggle('hidden');
      if (!adminPanel.classList.contains('hidden')) {
        benchmarkPanel.classList.add('hidden');
        syncSettingsForm();
      }
    });
  }

  if (toggleBenchmarkBtn && benchmarkPanel) {
    toggleBenchmarkBtn.addEventListener('click', () => {
      benchmarkPanel.classList.toggle('hidden');
      if (!benchmarkPanel.classList.contains('hidden')) {
        adminPanel.classList.add('hidden');
      }
    });
  }

  if (startBenchmarkBtn) {
    startBenchmarkBtn.addEventListener('click', () => {
      if (benchmarkActive) return;

      const time = parseInt(benchmarkTimeInput.value) || 5000;
      const threads = parseInt(benchmarkThreadsInput.value) || 4;

      benchmarkActive = true;
      startBenchmarkBtn.disabled = true;
      startBenchmarkBtn.innerText = 'Benchmarking...';
      benchmarkResults.classList.remove('hidden');

      resDepth.innerText = '-';
      resNodes.innerText = '-';
      resNps.innerText = '-';
      resTime.innerText = '-';

      addLog('ENG', `Starting benchmark: ${time}ms, ${threads} threads`);

      engineWorker.postMessage('stop');
      engineWorker.postMessage(`setoption name Threads value ${threads}`);
      engineWorker.postMessage('setoption name Hash value 128');
      engineWorker.postMessage('position startpos');
      engineWorker.postMessage(`go movetime ${time}`);
    });
  }

  if (adminSaveBtn) {
    adminSaveBtn.addEventListener('click', () => {
      applySettings(readSettingsForm(), true);
      addLog('GAME', 'Settings updated');
    });
  }

  if (adminResetBtn) {
    adminResetBtn.addEventListener('click', () => {
      applySettings({ ...DEFAULT_SETTINGS }, true);
      syncSettingsForm();
      addLog('GAME', 'Settings reset to defaults');
    });
  }

  if (adminExportBtn && adminJson) {
    adminExportBtn.addEventListener('click', () => {
      adminJson.value = JSON.stringify(settings, null, 2);
    });
  }

  if (adminImportBtn && adminJson) {
    adminImportBtn.addEventListener('click', () => {
      try {
        const parsed = JSON.parse(adminJson.value);
        applySettings(parsed, true);
        syncSettingsForm();
        addLog('GAME', 'Settings imported');
      } catch {
        addLog('GAME', 'Invalid settings JSON');
      }
    });
  }

  function resetGameForImport() {
    stopEngineRepeat();
    stopThinkingPulse();
    board = initializeBoard();
    castling = 'KQkq';
    enPassant = null;
    halfmove = 0;
    fullmove = 1;
    turn = 'w';
    selection = 0;
    fromFile = 0;
    fromRank = 0;
    toFile = 0;
    toRank = 0;
    pendingPromotionSquare = null;
    moveHistory = [];
    gameState = STATE.FROM_FILE;
    updateUI();
  }

  function importMoves(text) {
    const tokens = text
      .replace(/[^a-h1-8\s]/gi, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((m) => m.slice(0, 4).toLowerCase());

    if (tokens.length === 0) {
      addLog('GAME', 'No moves provided');
      return;
    }

    resetGameForImport();

    for (const move of tokens) {
      if (move.length !== 4) {
        addLog('GAME', `Invalid move: ${move}`);
        break;
      }
      const from = algebraicToSquare(move.slice(0, 2));
      const to = algebraicToSquare(move.slice(2, 4));
      
      // Need to use temporary turn for multi-move validation during import
      if (!isValidMoveWithState(board, from, to, turn, enPassant, castling)) {
        addLog('GAME', `Illegal move in import: ${move}`);
        break;
      }
      applyMove(from, to);
      moveHistory.push(move);
    }
    
    lastEngineMove = null;
    const fen = boardToFEN(board, turn, castling, enPassant !== null ? squareToAlgebraic(enPassant) : '-', halfmove, fullmove);
    
    // Logic fix: Determine whose turn it is AFTER all moves are applied
    if (turn === playerColor) {
      gameState = STATE.FROM_FILE;
      addLog('GAME', 'Ready for player move');
    } else {
      gameState = STATE.WAITING_ENGINE;
      addLog('GAME', 'Engine starting search from imported position');
      startThinkingPulse();
      engineMove(fen);
    }
    updateUI();
  }

  if (copyMovesBtn) {
    copyMovesBtn.addEventListener('click', async () => {
      const text = moveHistory.join(' ');
      try {
        await navigator.clipboard.writeText(text);
        addLog('GAME', 'Moves copied to clipboard');
      } catch {
        addLog('GAME', 'Failed to copy moves');
      }
    });
  }

  if (applyMovesBtn && movesInput) {
    applyMovesBtn.addEventListener('click', () => {
      importMoves(movesInput.value || '');
    });
  }

  if (clearMovesBtn) {
    clearMovesBtn.addEventListener('click', () => {
      moveHistory = [];
      updateUI();
    });
  }

  if (submitManualMoveBtn && manualMoveInput) {
    submitManualMoveBtn.addEventListener('click', () => {
      const move = manualMoveInput.value.trim().toLowerCase();
      if (move.length < 4) {
        addLog('GAME', 'Invalid move format');
        return;
      }
      if (gameState === STATE.IDLE || gameState === STATE.COLOR_SELECT || gameState === STATE.WAITING_ENGINE) {
        addLog('GAME', 'Cannot move in current state');
        return;
      }

      if (gameState === STATE.ENGINE_MOVE) {
        stopEngineRepeat();
        gameState = STATE.FROM_FILE;
      }

      const from = algebraicToSquare(move.slice(0, 2));
      const to = algebraicToSquare(move.slice(2, 4));

      if (!isValidMoveWithState(board, from, to, turn, enPassant, castling)) {
        addLog('GAME', `Illegal manual move: ${move}`);
        sendVibration(PATTERNS.ILLEGAL.pattern, PATTERNS.ILLEGAL.pwm);
        return;
      }

      addLog('GAME', `Manual move: ${move}`);
      manualMoveInput.value = '';
      moveHistory.push(move);
      
      const result = applyMove(from, to);
      
      // Sync manual move with button flow
      selection = 0;
      fromFile = 0;
      fromRank = 0;
      toFile = 0;
      toRank = 0;

      // Promotion is auto-handled by makeMove, just trigger engine
      gameState = STATE.WAITING_ENGINE;
      startThinkingPulse();
      engineMove(boardToFEN(board, turn, castling, enPassant !== null ? squareToAlgebraic(enPassant) : '-', halfmove, fullmove));
      updateUI();
    });

    manualMoveInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitManualMoveBtn.click();
    });
  }

  function smoothPattern(pattern, allowLong = false) {
    const result = [];
    for (let i = 0; i < pattern.length; i++) {
      let value = pattern[i];
      
      // Cap pulse duration to 120ms max for "high ground" consistency
      // Unless allowLong is true (for alert/illegal patterns)
      if (i % 2 === 0 && !allowLong) {
        value = Math.min(120, value);
      }

      if (i % 2 === 0 && value < settings.motorMinOnMs) {
        result.push(settings.motorMinOnMs);
        continue;
      }
      if (i % 2 === 1 && value < settings.motorMinOffMs) {
        // Only merge if the gap is extremely short (hardware jitter prevention)
        // Don't merge clicks!
        if (value < 50 && result.length > 0) {
          result[result.length - 1] += value;
          if (i + 1 < pattern.length) {
            const nextVal = allowLong ? pattern[i + 1] : Math.min(120, pattern[i + 1]);
            result[result.length - 1] += nextVal;
            i += 1;
          }
          continue;
        }
      }
      result.push(value);
    }
    return result;
  }

  function sendVibration(pattern, pwm, freq, allowLong = false) {
    const resolvedFreq = typeof freq === 'number' ? freq : settings.freq;
    // Check if this is a long pattern (any element > 200ms means it's an alert)
    const isLongPattern = allowLong || pattern.some(ms => ms > 200);
    const scaledPattern = smoothPattern(pattern.map((ms, index) => {
      if (index % 2 === 0) {
        return Math.max(10, Math.round(ms * VIBE_ON_SCALE * settings.motorOnScale));
      }
      return ms;
    }), isLongPattern);
    const scaledPwm = VIBE_PWM_NORMAL;
    if (settings.useMotorVibrate && ws && connected) {
      const payload = { type: 'vibrate', pattern: scaledPattern, pwm: scaledPwm, freq: resolvedFreq };
      ws.send(JSON.stringify(payload));
      addLog('MTR', `pattern=${scaledPattern.join(',')} pwm=${scaledPwm} freq=${resolvedFreq}`);
    }
    if (settings.usePhoneVibrate && navigator.vibrate) {
      navigator.vibrate(scaledPattern);
    }
  }

  function addLog(type, message) {
    const time = formatTime(new Date());
    const row = document.createElement('div');
    row.className = 'log-row';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${time}]`;
    const typeSpan = document.createElement('span');
    typeSpan.style.color = LOG_COLORS[type] || '#e2e8f0';
    typeSpan.textContent = `[${type}]`;
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    row.appendChild(timeSpan);
    row.appendChild(typeSpan);
    row.appendChild(msgSpan);
    debugPanel.appendChild(row);
    debugPanel.scrollTop = debugPanel.scrollHeight;
  }

  function formatTime(date) {
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
  }

  function updateUI() {
    let wsLabel = 'Disconnected';
    if (connected) {
      wsLabel = 'Connected';
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      wsLabel = 'Connecting...';
    }
    wsStatus.textContent = wsLabel;
    const baseStatus = getStatusLabel();
    const needsUnlock = settings.usePhoneVibrate && !vibrationUnlocked;
    statusText.textContent = needsUnlock ? `${baseStatus} (tap screen to enable vibration)` : baseStatus;
    selectionText.textContent = String(selection);
    tapCountText.textContent = String(tapCount);
    turnText.textContent = turn === 'w' ? 'White' : 'Black';
    renderBoard();
    renderMoves();
  }

  function renderMoves() {
    if (!movesListEl) return;
    movesListEl.innerHTML = '';
    if (moveHistory.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No moves yet.';
      movesListEl.appendChild(empty);
      return;
    }
    for (let i = 0; i < moveHistory.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'moves-row';
      const index = document.createElement('span');
      index.textContent = `${Math.floor(i / 2) + 1}.`;
      const white = document.createElement('span');
      white.textContent = moveHistory[i] || '';
      const black = document.createElement('span');
      black.textContent = moveHistory[i + 1] || '';
      row.appendChild(index);
      row.appendChild(white);
      row.appendChild(black);
      movesListEl.appendChild(row);
    }
  }

  const PIECE_SYMBOLS = {
    wK: '♔',
    wQ: '♕',
    wR: '♖',
    wB: '♗',
    wN: '♘',
    wP: '♙',
    bK: '♚',
    bQ: '♛',
    bR: '♜',
    bB: '♝',
    bN: '♞',
    bP: '♟'
  };

  function renderBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = '';
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const idx = rank * 8 + file;
        const square = document.createElement('div');
        const isDark = (rank + file) % 2 === 1;
        square.className = `square ${isDark ? 'dark' : 'light'}`;
        const piece = board[idx];
        square.textContent = PIECE_SYMBOLS[piece] || '';
        boardEl.appendChild(square);
      }
    }
  }

  function getStatusLabel() {
    switch (gameState) {
      case STATE.IDLE:
        return 'Idle - longpress to start';
      case STATE.COLOR_SELECT:
        return 'Color select: 1=White, 2=Black';
      case STATE.FROM_FILE:
        return 'From file (a-h)';
      case STATE.FROM_RANK:
        return 'From rank (1-8)';
      case STATE.TO_FILE:
        return 'To file (a-h)';
      case STATE.TO_RANK:
        return 'To rank (1-8)';
      case STATE.PROMOTION:
        return 'Promotion (1=Q,2=R,3=B,4=N)';
      case STATE.WAITING_ENGINE:
        return 'Engine thinking...';
      case STATE.ENGINE_MOVE:
        return 'Engine move: vibrating';
      default:
        return '';
    }
  }

  function handleButton(action) {
    if (Date.now() < ignoreButtonsUntil) {
      addLog('BTN', `Ignored (${action})`);
      return;
    }
    if (action === 'panic') {
      addLog('BTN', 'panic');
      if (gameState === STATE.IDLE) {
        if (adminPanel) {
          adminPanel.classList.remove('hidden');
          syncSettingsForm();
        }
        updateUI();
      } else {
        location.reload();
      }
      return;
    }
    lastInputTime = Date.now();
    lastIdleCancelAt = 0;
    lastIdleResetAt = 0;
    lastIdleReplayAt = 0;
    if (gameState === STATE.ENGINE_MOVE) {
      stopEngineRepeat();
      gameState = STATE.FROM_FILE;
      selection = 0;
    }
    if (action === 'tap') handleTap();
    if (action === 'longpress') handleLongPress();
    // doubletap disabled (hardware noise)
    updateUI();
  }

  function handleTap() {
    sendVibration(PATTERNS.CLICK.pattern, PATTERNS.CLICK.pwm);
    if (gameState === STATE.IDLE) {
      tapCount = Math.min(8, tapCount + 1);
      return;
    }
    selection = selection >= 8 ? 1 : selection + 1;
  }

  function handleLongPress() {
    sendVibration(PATTERNS.CONFIRM.pattern, PATTERNS.CONFIRM.pwm);

    if (gameState === STATE.IDLE) {
      gameState = STATE.COLOR_SELECT;
      selection = 0;
      tapCount = 0;
      return;
    }

    if (gameState === STATE.COLOR_SELECT) {
      const choice = selection === 2 ? 'b' : 'w';
      playerColor = choice;
      turn = 'w';
      selection = 0;
      board = initializeBoard();
      castling = 'KQkq';
      enPassant = null;
      halfmove = 0;
      fullmove = 1;
      if (choice === 'b') {
        gameState = STATE.WAITING_ENGINE;
        startThinkingPulse();
        engineMove(boardToFEN(board, 'w', castling, '-', halfmove, fullmove));
      } else {
        gameState = STATE.FROM_FILE;
      }
      return;
    }

    if (gameState === STATE.FROM_FILE) {
      if (selection === 0) return;
      fromFile = selection;
      selection = 0;
      gameState = STATE.FROM_RANK;
      return;
    }

    if (gameState === STATE.FROM_RANK) {
      if (selection === 0) return;
      fromRank = selection;
      selection = 0;
      gameState = STATE.TO_FILE;
      return;
    }

    if (gameState === STATE.TO_FILE) {
      if (selection === 0) return;
      toFile = selection;
      selection = 0;
      gameState = STATE.TO_RANK;
      return;
    }

    if (gameState === STATE.TO_RANK) {
      if (selection === 0) return;
      toRank = selection;

      const move = `${FILES[fromFile - 1]}${fromRank}${FILES[toFile - 1]}${toRank}`;
      const from = algebraicToSquare(move.slice(0, 2));
      const to = algebraicToSquare(move.slice(2, 4));

      if (!isValidMoveWithState(board, from, to, turn, enPassant, castling)) {
        sendVibration(PATTERNS.ILLEGAL.pattern, PATTERNS.ILLEGAL.pwm);
        gameState = STATE.FROM_FILE;
        selection = 0;
        return;
      }

      addLog('GAME', `Player move: ${move}`);
      moveHistory.push(move);

      const result = applyMove(from, to);
      // Promotion is auto-handled by makeMove (auto-queen)
      gameState = STATE.WAITING_ENGINE;
      startThinkingPulse();
      engineMove(boardToFEN(board, turn, castling, enPassant !== null ? squareToAlgebraic(enPassant) : '-', halfmove, fullmove));
      selection = 0;
      return;
    }

    if (gameState === STATE.PROMOTION) {
      // Promotion state is unused (auto-queen)
      gameState = STATE.WAITING_ENGINE;
      startThinkingPulse();
      engineMove(boardToFEN(board, turn, castling, enPassant !== null ? squareToAlgebraic(enPassant) : '-', halfmove, fullmove));
    }
  }

  function handleDoubleTap() {}

  function startThinkingPulse() {
    stopThinkingPulse();
    sendVibration(PATTERNS.THINKING_PULSE.pattern, PATTERNS.THINKING_PULSE.pwm);
    // Repeat tiny pulses every 2 seconds while thinking
    thinkingTimer = setInterval(() => {
      sendVibration(PATTERNS.THINKING_PULSE.pattern, PATTERNS.THINKING_PULSE.pwm);
    }, 2000);
  }

  function stopThinkingPulse() {
    if (thinkingTimer) {
      clearInterval(thinkingTimer);
      thinkingTimer = null;
    }
  }

  let engineMoveStartTime = 0;

  function engineMove(fen) {
    lastInfoBestMove = null;
    engineMoveStartTime = Date.now();
    
    // Clear hash tables every 20 moves to prevent memory buildup and timeouts
    if (fullmove > 1 && fullmove % 20 === 1) {
      addLog('ENG', 'Clearing hash tables for fresh search...');
      engineWorker.postMessage('ucinewgame');
      engineWorker.postMessage('isready');
    }
    
    engineWorker.postMessage(`position fen ${fen}`);
    const moveTime = getAdaptiveMoveTime();
    const effectiveDepth = settings.boostEnabled ? settings.boostDepth : settings.engineDepth;
    
    addLog('ENG', `Thinking for ${moveTime}ms (Depth: ${effectiveDepth || 'Unlimited'})`);

    if (Number.isFinite(effectiveDepth) && effectiveDepth > 0) {
      engineWorker.postMessage(`go depth ${effectiveDepth} movetime ${moveTime}`);
    } else {
      engineWorker.postMessage(`go movetime ${moveTime}`);
    }
    
    if (engineThinkTimeout) {
      clearTimeout(engineThinkTimeout);
    }
    if (engineTimeoutFallback) {
      clearTimeout(engineTimeoutFallback);
    }
    
    engineThinkTimeout = setTimeout(() => {
      addLog('ENG', 'Engine timeout detected!');
      sendVibration(PATTERNS.TIMEOUT.pattern, PATTERNS.TIMEOUT.pwm);
      
      // Attempt hard rethink: restart worker to clear memory/stuck states without page reload
      addLog('ENG', 'Restarting engine for a fresh rethink...');
      initEngine();
      
      // Send the position again and restart the search
      const fen = boardToFEN(board, turn, castling, enPassant !== null ? squareToAlgebraic(enPassant) : '-', halfmove, fullmove);
      engineMove(fen);
    }, Math.max(moveTime + 10000, 40000));
  }

  function getAdaptiveMoveTime() {
    const phase = estimateGamePhase();
    if (settings.boostEnabled) {
      if (phase === 'opening') return settings.boostOpeningTimeMs;
      if (phase === 'endgame') return settings.boostEndgameTimeMs;
      return settings.boostMiddlegameTimeMs;
    }
    if (phase === 'opening') return settings.openingTimeMs;
    if (phase === 'endgame') return settings.endgameTimeMs;
    return settings.middlegameTimeMs;
  }

  function estimateGamePhase() {
    let materialScore = 0;
    for (const piece of board) {
      if (!piece) continue;
      switch (piece[1]) {
        case 'Q':
          materialScore += 9;
          break;
        case 'R':
          materialScore += 5;
          break;
        case 'B':
        case 'N':
          materialScore += 3;
          break;
        case 'P':
          materialScore += 1;
          break;
        default:
          break;
      }
    }

    if (fullmove <= 10 && materialScore >= 56) return 'opening';
    if (materialScore <= 20) return 'endgame';
    return 'middlegame';
  }

  function communicateMove(move) {
    const fromFileLocal = move.charCodeAt(0) - 96;
    const fromRankLocal = parseInt(move[1]);
    const toFileLocal = move.charCodeAt(2) - 96;
    const toRankLocal = parseInt(move[3]);

    const pattern = [];
    const CLICK_DURATION = settings.clickMs; // Use user defined click duration as high ground
    const GAP = 250;
    const PAUSE = 600;

    const addClicks = (count) => {
      for (let i = 0; i < count; i++) {
        pattern.push(CLICK_DURATION);
        if (i < count - 1) pattern.push(GAP);
      }
    };

    addClicks(fromFileLocal);
    pattern.push(PAUSE);
    addClicks(fromRankLocal);
    pattern.push(PAUSE);
    addClicks(toFileLocal);
    pattern.push(PAUSE);
    addClicks(toRankLocal);

    sendVibration(pattern, VIBE_PWM_NORMAL);

    const totalMs = pattern.reduce((sum, value) => sum + value, 0);
    return new Promise((resolve) => setTimeout(resolve, totalMs));
  }


  let engineRepeatCount = 0;

  function startEngineRepeat(playFn, intervalMs, initialDelayMs = 0) {
    stopEngineRepeat();
    engineRepeatActive = true;
    engineRepeatCount = 0;
    
    const loop = async () => {
      if (!engineRepeatActive) return;
      await playFn();
      engineRepeatCount++;
      if (!engineRepeatActive) return;
      
      // First 2 repeats happen quickly (5s apart), then slow down to 1 minute
      let nextInterval;
      if (engineRepeatCount < 2) {
        nextInterval = 5000; // 5 seconds for first 2 repeats
      } else {
        nextInterval = 60000; // 1 minute after that
      }
      engineRepeatTimer = setTimeout(loop, nextInterval);
    };
    
    if (initialDelayMs > 0) {
      engineRepeatTimer = setTimeout(loop, initialDelayMs);
    } else {
      loop();
    }
  }

  function stopEngineRepeat() {
    engineRepeatActive = false;
    if (engineRepeatTimer) {
      clearTimeout(engineRepeatTimer);
      engineRepeatTimer = null;
    }
  }

  function handleEngineMove(move) {
    if (!move || move === '(none)') return;
    lastEngineMove = move;
    const from = algebraicToSquare(move.slice(0, 2));
    const to = algebraicToSquare(move.slice(2, 4));
    applyMove(from, to);
    gameState = STATE.ENGINE_MOVE;

    moveHistory.push(move.slice(0, 4));

    const commMove = move.slice(0, 4);
    startEngineRepeat(
      () => communicateMove(commMove),
      settings.engineRepeatIntervalMs,
      settings.engineRepeatInitialDelayMs
    );

    if (isInCheck(board, turn)) {
      sendVibration(PATTERNS.CHECK.pattern, PATTERNS.CHECK.pwm);
    }

    if (isCheckmate(board, turn)) {
      sendVibration(PATTERNS.LOSE.pattern, PATTERNS.LOSE.pwm);
      gameState = STATE.IDLE;
      stopEngineRepeat();
    }
  }

  function applyMove(from, to) {
    const piece = board[from];
    let newCastling = castling;
    if (piece === 'wK') newCastling = newCastling.replace('K', '').replace('Q', '');
    if (piece === 'bK') newCastling = newCastling.replace('k', '').replace('q', '');
    if (piece === 'wR' && from === 0) newCastling = newCastling.replace('Q', '');
    if (piece === 'wR' && from === 7) newCastling = newCastling.replace('K', '');
    if (piece === 'bR' && from === 56) newCastling = newCastling.replace('q', '');
    if (piece === 'bR' && from === 63) newCastling = newCastling.replace('k', '');

    let newBoard = board.slice();
    let captured = null;

    if (piece[1] === 'P' && enPassant !== null && to === enPassant && board[to] === '') {
      const dir = piece[0] === 'w' ? -1 : 1;
      const capturedIndex = to + dir * 8;
      captured = newBoard[capturedIndex] || null;
      newBoard[capturedIndex] = '';
    }

    const result = makeMove(newBoard, from, to);
    newBoard = result.newBoard;
    if (result.captured) captured = result.captured;

    if (piece[1] === 'K' && Math.abs(to - from) === 2) {
      if (to === 6) {
        newBoard[5] = newBoard[7];
        newBoard[7] = '';
      } else if (to === 2) {
        newBoard[3] = newBoard[0];
        newBoard[0] = '';
      } else if (to === 62) {
        newBoard[61] = newBoard[63];
        newBoard[63] = '';
      } else if (to === 58) {
        newBoard[59] = newBoard[56];
        newBoard[56] = '';
      }
    }

    let newEnPassant = null;
    if (piece[1] === 'P') {
      const dir = piece[0] === 'w' ? 1 : -1;
      const startRank = piece[0] === 'w' ? 1 : 6;
      if (Math.floor(from / 8) === startRank && Math.floor(to / 8) === startRank + 2 * dir) {
        newEnPassant = (startRank + dir) * 8 + (from % 8);
      }
    }

    // Promotion is now handled directly in makeMove (auto-queen)
    // No need for pendingPromotionSquare anymore

    const nextTurn = turn === 'w' ? 'b' : 'w';
    const nextHalfmove = captured || piece[1] === 'P' ? 0 : halfmove + 1;
    const nextFullmove = turn === 'b' ? fullmove + 1 : fullmove;

    board = newBoard;
    castling = newCastling;
    enPassant = newEnPassant;
    halfmove = nextHalfmove;
    fullmove = nextFullmove;
    turn = nextTurn;

    if (isCheckmate(board, nextTurn)) {
      sendVibration(PATTERNS.WIN.pattern, PATTERNS.WIN.pwm);
      gameState = STATE.IDLE;
      stopEngineRepeat();
    }

    updateUI();

    return {
      newBoard,
      promotion: result.promotion,
      nextTurn,
      nextHalfmove,
      nextFullmove,
      nextCastling: newCastling,
      nextEnPassant: newEnPassant
    };
  }

  function initializeBoard() {
    const empty = Array(64).fill('');
    const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let i = 0; i < 8; i++) {
      empty[i] = `w${backRank[i]}`;
      empty[i + 8] = 'wP';
      empty[i + 48] = 'bP';
      empty[i + 56] = `b${backRank[i]}`;
    }
    return empty;
  }

  function squareToAlgebraic(index) {
    const file = FILES[index % 8];
    const rank = Math.floor(index / 8) + 1;
    return `${file}${rank}`;
  }

  function algebraicToSquare(notation) {
    const file = notation.charCodeAt(0) - 97;
    const rank = Number(notation[1]) - 1;
    return rank * 8 + file;
  }

  function boardToFEN(boardState, currentTurn, castlingState, enPassantSquare, half, full) {
    let fen = '';
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const idx = rank * 8 + file;
        const piece = boardState[idx];
        if (!piece) {
          empty++;
        } else {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }
          const symbol = piece[0] === 'w' ? piece[1] : piece[1].toLowerCase();
          fen += symbol;
        }
      }
      if (empty > 0) fen += empty;
      if (rank > 0) fen += '/';
    }
    const castlingField = castlingState === '' ? '-' : castlingState;
    return `${fen} ${currentTurn} ${castlingField} ${enPassantSquare} ${half} ${full}`;
  }

  function isSameColor(piece, color) {
    return piece && piece.startsWith(color);
  }

  function isOpponent(piece, color) {
    return piece && !piece.startsWith(color);
  }

  function inBounds(file, rank) {
    return file >= 0 && file < 8 && rank >= 0 && rank < 8;
  }

  function getPieceMoves(boardState, from, color, enPassantTarget, castlingState) {
    const piece = boardState[from];
    if (!piece) return [];
    const type = piece[1];
    const file = from % 8;
    const rank = Math.floor(from / 8);
    const moves = [];

    const addRay = (df, dr) => {
      let f = file + df;
      let r = rank + dr;
      while (inBounds(f, r)) {
        const idx = r * 8 + f;
        if (boardState[idx] === '') {
          moves.push(idx);
        } else {
          if (isOpponent(boardState[idx], color)) moves.push(idx);
          break;
        }
        f += df;
        r += dr;
      }
    };

    if (type === 'P') {
      const dir = color === 'w' ? 1 : -1;
      const startRank = color === 'w' ? 1 : 6;
      const one = (rank + dir) * 8 + file;
      if (inBounds(file, rank + dir) && boardState[one] === '') {
        moves.push(one);
        const two = (rank + 2 * dir) * 8 + file;
        if (rank === startRank && boardState[two] === '') moves.push(two);
      }
      [-1, 1].forEach((df) => {
        const f = file + df;
        const r = rank + dir;
        if (!inBounds(f, r)) return;
        const idx = r * 8 + f;
        if (isOpponent(boardState[idx], color)) moves.push(idx);
        if (enPassantTarget === idx) moves.push(idx);
      });
    } else if (type === 'N') {
      const deltas = [
        [1, 2], [2, 1], [2, -1], [1, -2],
        [-1, -2], [-2, -1], [-2, 1], [-1, 2]
      ];
      deltas.forEach(([df, dr]) => {
        const f = file + df;
        const r = rank + dr;
        if (!inBounds(f, r)) return;
        const idx = r * 8 + f;
        if (boardState[idx] === '' || isOpponent(boardState[idx], color)) moves.push(idx);
      });
    } else if (type === 'B') {
      addRay(1, 1);
      addRay(1, -1);
      addRay(-1, 1);
      addRay(-1, -1);
    } else if (type === 'R') {
      addRay(1, 0);
      addRay(-1, 0);
      addRay(0, 1);
      addRay(0, -1);
    } else if (type === 'Q') {
      addRay(1, 0);
      addRay(-1, 0);
      addRay(0, 1);
      addRay(0, -1);
      addRay(1, 1);
      addRay(1, -1);
      addRay(-1, 1);
      addRay(-1, -1);
    } else if (type === 'K') {
      const deltas = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1]
      ];
      deltas.forEach(([df, dr]) => {
        const f = file + df;
        const r = rank + dr;
        if (!inBounds(f, r)) return;
        const idx = r * 8 + f;
        if (boardState[idx] === '' || isOpponent(boardState[idx], color)) moves.push(idx);
      });
      if (color === 'w') {
        if (castlingState.includes('K') && boardState[5] === '' && boardState[6] === '') moves.push(6);
        if (castlingState.includes('Q') && boardState[1] === '' && boardState[2] === '' && boardState[3] === '') moves.push(2);
      } else {
        if (castlingState.includes('k') && boardState[61] === '' && boardState[62] === '') moves.push(62);
        if (castlingState.includes('q') && boardState[57] === '' && boardState[58] === '' && boardState[59] === '') moves.push(58);
      }
    }

    return moves;
  }

  function isInCheck(boardState, color) {
    const kingIndex = boardState.findIndex((p) => p === `${color}K`);
    if (kingIndex === -1) return false;
    const opponent = color === 'w' ? 'b' : 'w';
    for (let i = 0; i < 64; i++) {
      if (boardState[i] && isSameColor(boardState[i], opponent)) {
        const moves = getPieceMoves(boardState, i, opponent, null, '');
        if (moves.includes(kingIndex)) return true;
      }
    }
    return false;
  }

  function getAllLegalMoves(boardState, color, enPassantTarget, castlingState) {
    const moves = [];
    for (let i = 0; i < 64; i++) {
      if (!boardState[i] || !isSameColor(boardState[i], color)) continue;
      const pseudo = getPieceMoves(boardState, i, color, enPassantTarget, castlingState);
      for (const to of pseudo) {
        const testBoard = boardState.slice();
        testBoard[to] = testBoard[i];
        testBoard[i] = '';
        if (!isInCheck(testBoard, color)) {
          moves.push({ from: i, to });
        }
      }
    }
    return moves;
  }

  function isCheckmate(boardState, color) {
    if (!isInCheck(boardState, color)) return false;
    return getAllLegalMoves(boardState, color, null, '').length === 0;
  }

  function isStalemate(boardState, color) {
    if (isInCheck(boardState, color)) return false;
    return getAllLegalMoves(boardState, color, null, '').length === 0;
  }

  function isValidMoveWithState(boardState, from, to, color, enPassantTarget, castlingState) {
    const piece = boardState[from];
    if (!piece || !isSameColor(piece, color)) return false;
    const moves = getPieceMoves(boardState, from, color, enPassantTarget, castlingState);
    if (!moves.includes(to)) return false;

    if (piece[1] === 'K' && Math.abs(to - from) === 2) {
      const step = to > from ? 1 : -1;
      const passSquares = [from + step, from + 2 * step];
      for (const square of passSquares) {
        const testBoard = boardState.slice();
        testBoard[square] = testBoard[from];
        testBoard[from] = '';
        if (isInCheck(testBoard, color)) return false;
      }
    }

    const testBoard = boardState.slice();
    testBoard[to] = testBoard[from];
    testBoard[from] = '';
    return !isInCheck(testBoard, color);
  }

  function makeMove(boardState, from, to) {
    const newBoard = boardState.slice();
    const moving = newBoard[from];
    const captured = newBoard[to] || null;
    newBoard[to] = moving;
    newBoard[from] = '';
    let promotion = null;
    if (moving && moving[1] === 'P') {
      const rank = Math.floor(to / 8);
      if (rank === 7 || rank === 0) {
        // Auto-promote to Queen immediately
        newBoard[to] = `${moving[0]}Q`;
        promotion = `${moving[0]}Q`;
      }
    }
    return { newBoard, captured, promotion };
  }

  const testFrequencies = [30];
  let testIndex = 0;
  testMotorBtn.addEventListener('click', () => {
    const freq = testFrequencies[testIndex];
    testIndex = (testIndex + 1) % testFrequencies.length;
    sendVibration([200, 200, 200], 200, freq);
  });

  forceReconnectBtn.addEventListener('click', () => {
    addLog('WS', 'Force reconnect');
    ignoreButtonsUntil = Date.now() + 2000;
    tapCount = 0;
    selection = 0;
    gameState = STATE.IDLE;
    stopEngineRepeat();
    stopThinkingPulse();
    lastIdleCancelAt = 0;
    lastIdleResetAt = 0;
    lastIdleReplayAt = 0;
    updateUI();
    forceReconnect();
  });

  applySettings(settings, false);
  syncSettingsForm();

  connectWS();
  updateUI();

  let lastReplayTime = 0;

  setInterval(() => {
    const idleMs = Date.now() - lastInputTime;
    const inMoveEntry = [STATE.FROM_FILE, STATE.FROM_RANK, STATE.TO_FILE, STATE.TO_RANK, STATE.PROMOTION].includes(gameState);

    if (inMoveEntry && idleMs >= settings.idleCancelMs && selection !== 0 && lastIdleCancelAt === 0) {
      selection = 0;
      sendVibration([120], 120);
      lastIdleCancelAt = Date.now();
      updateUI();
    }

    if (inMoveEntry && idleMs >= settings.idleResetMs && lastIdleResetAt === 0) {
      gameState = STATE.FROM_FILE;
      selection = 0;
      fromFile = 0;
      fromRank = 0;
      toFile = 0;
      toRank = 0;
      sendVibration([120], 120);
      lastIdleResetAt = Date.now();
      updateUI();
    }

    if (idleMs >= settings.idleReplayMs && lastEngineMove && !engineRepeatActive && gameState !== STATE.WAITING_ENGINE) {
      if (lastIdleReplayAt === 0) {
        lastIdleReplayAt = Date.now();
        sendVibration([120], 120);
        communicateMove(lastEngineMove);
      }
    }
  }, 200);
})();

(function () {
  "use strict";

  if (!window.COLOR_FLASK_DATA) {
    return;
  }

  // Global app data and persistent runtime state.
  var APP_DATA = window.COLOR_FLASK_DATA;
  var STORAGE_KEY = "prism-pour-save-v2";
  var DEFAULT_SETTINGS = {
    haptics: true,
    bgm: true,
    sfx: true,
    motion: "standard"
  };
  var MOTION_SCALE_MAP = {
    calm: 0.86,
    standard: 1,
    vivid: 1.12
  };
  var TUTORIAL_STEPS = [
    {
      label: "Quick Guide",
      title: "먼저 출발 플라스크를 누르고, 목적지 플라스크를 눌러 옮기세요.",
      description: "선택된 플라스크는 떠오르고, 이동 가능한 대상은 은은한 민트 링으로 표시됩니다."
    },
    {
      label: "Rule",
      title: "맨 위에 이어진 같은 색 블록만 한 번에 이동할 수 있어요.",
      description: "도착 플라스크는 비어 있거나 같은 색 위여야 하고, 전체 블록이 들어갈 공간도 충분해야 합니다."
    },
    {
      label: "Assist",
      title: "힌트는 실제 해결 경로에서 다음 수를 찾아 추천합니다.",
      description: "되돌리기와 재시작, 햅틱과 사운드 설정까지 모두 모바일 플레이 기준으로 조정할 수 있습니다."
    }
  ];

  var stageMap = {};
  var difficultyMap = {};
  var solverColorMap = {};
  var state = {
    screen: "opening",
    selectedDifficulty: APP_DATA.difficulties[0].key,
    selectedFlaskCount: "all",
    settings: cloneObject(DEFAULT_SETTINGS),
    results: {},
    currentRun: null,
    selectedTubeIndex: null,
    validTargets: [],
    invalidTubes: [],
    recentMove: null,
    modal: null,
    notice: null,
    tutorialOpen: false,
    tutorialStep: 0,
    hasSeenTutorial: false,
    solvingHint: false,
    hintRequestId: 0,
    timerStartedAt: 0,
    timerId: 0,
    toastId: 0,
    toastHideId: 0,
    noticeId: 0,
    interactionUnlocked: false,
    storageWarned: false
  };
  var els = {};
  var audioEngine = null;
  var celebration = null;

  // Boot sequence: restore state, wire UI, then render the current screen.
  buildLookupTables();
  cacheElements();
  loadState();
  updateViewportMetrics();
  applyBranding();
  applySettings();
  audioEngine = createAudioEngine();
  celebration = createCelebrationController();
  bindEvents();
  registerServiceWorker();
  renderCurrentScreen();

  function buildLookupTables() {
    var paletteKeys = Object.keys(APP_DATA.palette);

    APP_DATA.stages.forEach(function (stage) {
      stageMap[stage.id] = stage;
    });

    APP_DATA.difficulties.forEach(function (difficulty) {
      difficultyMap[difficulty.key] = difficulty;
    });

    paletteKeys.forEach(function (key, index) {
      solverColorMap[key] = String.fromCharCode(65 + index);
    });
  }

  function cacheElements() {
    els.appShell = document.getElementById("app-shell");
    els.topFrame = document.getElementById("top-frame");
    els.globalBrandName = document.getElementById("global-brand-name");
    els.globalHelpButton = document.getElementById("global-help-button");
    els.globalSettingsButton = document.getElementById("global-settings-button");

    els.openingScreen = document.getElementById("opening-screen");
    els.openingBrand = document.getElementById("opening-brand");
    els.openingWelcome = document.getElementById("opening-welcome");
    els.openingTagline = document.getElementById("opening-tagline");
    els.openingProgressText = document.getElementById("opening-progress-text");
    els.openingProgressFill = document.getElementById("opening-progress-fill");
    els.openingProgressDetail = document.getElementById("opening-progress-detail");
    els.openingStartButton = document.getElementById("opening-start-button");
    els.openingContinueButton = document.getElementById("opening-continue-button");
    els.openingSettingsButton = document.getElementById("opening-settings-button");

    els.lobbyScreen = document.getElementById("lobby-screen");
    els.overallProgressText = document.getElementById("overall-progress-text");
    els.overallProgressFill = document.getElementById("overall-progress-fill");
    els.homeProgressSummary = document.getElementById("home-progress-summary");
    els.homeProgressDetail = document.getElementById("home-progress-detail");
    els.difficultySummary = document.getElementById("difficulty-summary");
    els.flaskSummary = document.getElementById("flask-summary");
    els.difficultySelector = document.getElementById("difficulty-selector");
    els.flaskCountSelector = document.getElementById("flask-count-selector");
    els.lobbyStartButton = document.getElementById("lobby-start-button");
    els.lobbyContinueButton = document.getElementById("lobby-continue-button");
    els.recordsButton = document.getElementById("records-button");
    els.stagePanelSummary = document.getElementById("stage-panel-summary");
    els.stageList = document.getElementById("stage-list");

    els.gameScreen = document.getElementById("game-screen");
    els.backLobbyButton = document.getElementById("back-lobby-button");
    els.gameHelpButton = document.getElementById("game-help-button");
    els.gameSettingsButton = document.getElementById("game-settings-button");
    els.gameStagePath = document.getElementById("game-stage-path");
    els.gameStageTitle = document.getElementById("game-stage-title");
    els.gameProgressText = document.getElementById("game-progress-text");
    els.gameProgressFill = document.getElementById("game-progress-fill");
    els.moveCount = document.getElementById("move-count");
    els.timerText = document.getElementById("timer-text");
    els.hintCount = document.getElementById("hint-count");
    els.gameNotice = document.getElementById("game-notice");
    els.boardCaption = document.getElementById("board-caption");
    els.boardStageMeta = document.getElementById("board-stage-meta");
    els.board = document.getElementById("board");
    els.hintButton = document.getElementById("hint-button");
    els.undoButton = document.getElementById("undo-button");
    els.restartButton = document.getElementById("restart-button");
    els.giveUpButton = document.getElementById("give-up-button");

    els.celebrationOverlay = document.getElementById("celebration-overlay");
    els.celebrationCanvas = document.getElementById("celebration-canvas");

    els.modalBackdrop = document.getElementById("modal-backdrop");
    els.modalTitle = document.getElementById("modal-title");
    els.modalBody = document.getElementById("modal-body");
    els.modalActions = document.getElementById("modal-actions");
    els.modalCloseButton = document.getElementById("modal-close-button");

    els.toast = document.getElementById("toast");

    els.tutorialOverlay = document.getElementById("tutorial-overlay");
    els.tutorialStepLabel = document.getElementById("tutorial-step-label");
    els.tutorialTitle = document.getElementById("tutorial-title");
    els.tutorialDescription = document.getElementById("tutorial-description");
    els.tutorialDots = document.getElementById("tutorial-dots");
    els.tutorialSkipButton = document.getElementById("tutorial-skip-button");
    els.tutorialNextButton = document.getElementById("tutorial-next-button");
  }

  function bindEvents() {
    document.addEventListener("pointerdown", unlockInteractiveFeatures, { passive: true });
    document.addEventListener("keydown", unlockInteractiveFeatures, { passive: true });

    window.addEventListener("resize", updateViewportMetrics);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportMetrics);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        pauseGameTimer();
        audioEngine.sync();
        saveState();
      } else {
        audioEngine.sync();
        if (state.screen === "game" && state.currentRun) {
          startGameTimer();
          renderGame();
        }
      }
    });

    window.addEventListener("beforeunload", function () {
      pauseGameTimer();
      saveState();
    });

    els.globalHelpButton.addEventListener("click", openHelpModal);
    els.globalSettingsButton.addEventListener("click", openSettingsModal);
    els.openingSettingsButton.addEventListener("click", openSettingsModal);
    els.openingStartButton.addEventListener("click", function () {
      goToLobby(true);
    });
    els.openingContinueButton.addEventListener("click", resumeCurrentRun);

    els.lobbyStartButton.addEventListener("click", startSuggestedStage);
    els.lobbyContinueButton.addEventListener("click", resumeCurrentRun);
    els.recordsButton.addEventListener("click", openRecordsModal);
    els.difficultySelector.addEventListener("click", onDifficultySelectorClick);
    els.flaskCountSelector.addEventListener("click", onFlaskSelectorClick);
    els.stageList.addEventListener("click", onStageListClick);

    els.backLobbyButton.addEventListener("click", function () {
      goToLobby(false);
    });
    els.gameHelpButton.addEventListener("click", openHelpModal);
    els.gameSettingsButton.addEventListener("click", openSettingsModal);
    els.hintButton.addEventListener("click", requestHint);
    els.undoButton.addEventListener("click", undoMove);
    els.restartButton.addEventListener("click", confirmRestartStage);
    els.giveUpButton.addEventListener("click", confirmGiveUp);
    els.board.addEventListener("click", onBoardClick);

    els.modalBackdrop.addEventListener("click", onModalBackdropClick);
    els.modalCloseButton.addEventListener("click", closeModal);
    els.modalActions.addEventListener("click", onModalActionClick);
    els.modalBody.addEventListener("click", onModalBodyClick);

    els.tutorialSkipButton.addEventListener("click", closeTutorial);
    els.tutorialNextButton.addEventListener("click", advanceTutorial);
  }

  function unlockInteractiveFeatures() {
    if (state.interactionUnlocked) {
      return;
    }
    state.interactionUnlocked = true;
    audioEngine.unlock();
    audioEngine.sync();
  }

  function updateViewportMetrics() {
    var viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--app-height", Math.round(viewportHeight) + "px");
  }

  function applyBranding() {
    var appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    var descriptionMeta = document.querySelector('meta[name="description"]');

    document.title = APP_DATA.app.name;
    els.globalBrandName.textContent = APP_DATA.app.name;
    els.openingBrand.textContent = APP_DATA.app.name;
    els.openingWelcome.textContent = APP_DATA.app.openingCopy;
    els.openingTagline.textContent = APP_DATA.app.subtitle;

    if (appleTitleMeta) {
      appleTitleMeta.setAttribute("content", APP_DATA.app.name);
    }
    if (descriptionMeta) {
      descriptionMeta.setAttribute("content", APP_DATA.app.subtitle);
    }
  }

  function applySettings() {
    document.documentElement.style.setProperty(
      "--motion-scale",
      String(MOTION_SCALE_MAP[state.settings.motion] || MOTION_SCALE_MAP.standard)
    );
    if (audioEngine) {
      audioEngine.sync();
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
      return;
    }

    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function (error) {
        console.warn("Service worker registration failed:", error);
      });
    });
  }

  // Screen rendering
  function renderCurrentScreen() {
    document.body.setAttribute("data-screen", state.screen);
    setScreenVisibility("opening", state.screen === "opening");
    setScreenVisibility("lobby", state.screen === "lobby");
    setScreenVisibility("game", state.screen === "game");

    renderOpening();
    renderLobby();
    if (state.screen === "game") {
      renderGame();
    }
    renderModal();
    renderTutorial();
  }

  function setScreenVisibility(screenName, visible) {
    var element = screenName === "opening"
      ? els.openingScreen
      : screenName === "lobby"
        ? els.lobbyScreen
        : els.gameScreen;
    element.hidden = !visible;
    element.classList.toggle("is-active", visible);
  }

  function renderOpening() {
    var overall = getOverallStats();
    var continueStage = state.currentRun ? stageMap[state.currentRun.stageId] : null;
    var progressPercent = overall.total ? (overall.cleared / overall.total) * 100 : 0;
    var nextStage = getSuggestedStage();

    els.openingProgressText.textContent = overall.cleared + " / " + overall.total + " 완료";
    els.openingProgressFill.style.width = progressPercent.toFixed(1) + "%";
    els.openingProgressDetail.textContent = continueStage
      ? "이어하기 가능: " + getDifficultyLabel(continueStage.difficulty) + " " + continueStage.order + " - " + continueStage.title
      : nextStage
        ? "추천 시작: " + getDifficultyLabel(nextStage.difficulty) + " " + nextStage.order + " - " + nextStage.title
        : APP_DATA.app.installCopy;
    els.openingContinueButton.hidden = !continueStage;
  }

  function renderLobby() {
    var overall = getOverallStats();
    var progressPercent = overall.total ? (overall.cleared / overall.total) * 100 : 0;
    var suggestedStage = getSuggestedStage();
    var continueStage = state.currentRun ? stageMap[state.currentRun.stageId] : null;
    var difficultyStats = getDifficultyStats(state.selectedDifficulty);

    els.overallProgressText.textContent = overall.cleared + " / " + overall.total + " 완료";
    els.overallProgressFill.style.width = progressPercent.toFixed(1) + "%";
    els.homeProgressSummary.textContent = buildProgressNarrative();
    els.homeProgressDetail.textContent = continueStage
      ? "이어하기 가능: " + getDifficultyLabel(continueStage.difficulty) + " " + continueStage.order + " - " + continueStage.title
      : "현재 추천 스테이지를 바로 시작하거나, 아래에서 원하는 스테이지를 선택할 수 있습니다.";
    els.difficultySummary.textContent =
      difficultyMap[state.selectedDifficulty].description + " · " + difficultyStats.cleared + "/" + difficultyStats.total + " 완료";
    els.flaskSummary.textContent = state.selectedFlaskCount === "all"
      ? "현재 난이도의 전체 플라스크 구성을 표시합니다."
      : "플라스크 " + state.selectedFlaskCount + "개 스테이지만 표시합니다.";
    els.stagePanelSummary.textContent = getVisibleStages().length
      ? "선택된 조건의 스테이지 " + getVisibleStages().length + "개"
      : "표시할 스테이지가 없습니다.";

    els.lobbyStartButton.disabled = !suggestedStage;
    els.lobbyStartButton.textContent = suggestedStage
      ? getDifficultyLabel(suggestedStage.difficulty) + " " + suggestedStage.order + " 시작하기"
      : "시작 가능한 스테이지 없음";
    els.lobbyContinueButton.hidden = !continueStage;

    renderDifficultySelector();
    renderFlaskSelector();
    renderStageList();
  }

  function renderGame() {
    if (!state.currentRun) {
      return;
    }

    var stage = getCurrentStage();
    var diffStages = getStagesByDifficulty(stage.difficulty);
    var globalProgress = stage.globalOrder / APP_DATA.stages.length * 100;
    var run = state.currentRun;

    els.gameStagePath.textContent = getDifficultyLabel(stage.difficulty) + " · " + stage.order + " / " + diffStages.length;
    els.gameStageTitle.textContent = stage.title;
    els.gameProgressText.textContent = APP_DATA.stages.length + "개 중 " + stage.globalOrder + "번째 진행 중";
    els.gameProgressFill.style.width = globalProgress.toFixed(1) + "%";
    els.moveCount.textContent = run.moveCount + "회";
    els.timerText.textContent = formatTime(getElapsedMs());
    els.hintCount.textContent = run.hintsRemaining + " / " + stage.hintLimit;
    els.boardStageMeta.textContent = "플라스크 " + stage.flaskCount + "개 · 색상 " + stage.colors + "종 · 기준 이동 " + stage.par + "회";

    if (run.activeHint) {
      els.boardCaption.textContent = "힌트: " + (run.activeHint.source + 1) + "번 → " + (run.activeHint.target + 1) + "번";
    } else if (state.selectedTubeIndex !== null) {
      els.boardCaption.textContent =
        (state.selectedTubeIndex + 1) + "번 플라스크를 선택했습니다. 민트 링이 이동 가능한 목적지입니다.";
    } else {
      els.boardCaption.textContent = "출발 플라스크를 먼저 고르고, 도착 플라스크를 눌러 액체를 이동하세요.";
    }

    renderBoard();
    renderGameNotice();
    updateGameControls();
  }

  function renderDifficultySelector() {
    els.difficultySelector.innerHTML = APP_DATA.difficulties.map(function (difficulty) {
      var stats = getDifficultyStats(difficulty.key);
      var accent = getColorHex(difficulty.accent);
      var selectedClass = state.selectedDifficulty === difficulty.key ? " is-selected" : "";
      return (
        '<button class="chip-button' +
        selectedClass +
        '" type="button" data-difficulty="' +
        difficulty.key +
        '">' +
        '<span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:' + accent + ';"></span>' +
        difficulty.label +
        " " +
        stats.cleared +
        "/" +
        stats.total +
        "</button>"
      );
    }).join("");
  }

  function renderFlaskSelector() {
    var availableCounts = getAvailableCountsForDifficulty(state.selectedDifficulty);
    var buttons = [
      '<button class="chip-button' + (state.selectedFlaskCount === "all" ? " is-selected" : "") + '" type="button" data-flask-count="all">전체</button>'
    ];

    APP_DATA.flaskOptions.forEach(function (count) {
      var selectedClass = String(count) === state.selectedFlaskCount ? " is-selected" : "";
      var disabledClass = availableCounts.indexOf(count) === -1 ? " is-disabled" : "";
      buttons.push(
        '<button class="chip-button' +
        selectedClass +
        disabledClass +
        '" type="button" data-flask-count="' +
        count +
        '">' +
        count +
        "개</button>"
      );
    });

    els.flaskCountSelector.innerHTML = buttons.join("");
  }

  function renderStageList() {
    var visibleStages = getVisibleStages();

    if (!visibleStages.length) {
      els.stageList.innerHTML =
        '<article class="stage-card">' +
        '<p class="stage-card-description">현재 선택 조건에는 스테이지가 없습니다. 다른 플라스크 개수를 골라 보세요.</p>' +
        "</article>";
      return;
    }

    els.stageList.innerHTML = visibleStages.map(function (stage) {
      var result = getStageResult(stage.id);
      var unlocked = isStageUnlocked(stage);
      var currentStage = getCurrentStageForDifficulty(stage.difficulty);
      var isCurrent = currentStage && currentStage.id === stage.id && !result.cleared;
      var statusClass = result.cleared ? "cleared" : isCurrent ? "current" : unlocked ? "current" : "locked";
      var statusLabel = result.cleared ? "완료" : isCurrent ? "진행 중" : unlocked ? "도전 가능" : "잠김";
      var bestLine = result.cleared && result.bestTimeMs !== null
        ? "최고 기록 " + result.bestMoves + "회 · " + formatTime(result.bestTimeMs)
        : "기준 이동 " + stage.par + "회";

      return (
        '<article class="stage-card' + (unlocked ? "" : " is-locked") + '">' +
        '<div class="stage-card-head">' +
        '<div>' +
        '<p class="stage-card-subtitle">' +
        getDifficultyLabel(stage.difficulty) +
        " " +
        stage.order +
        " / " +
        getStagesByDifficulty(stage.difficulty).length +
        "</p>" +
        '<h4 class="stage-card-title">' + escapeHtml(stage.title) + "</h4>" +
        "</div>" +
        '<span class="stage-status ' + statusClass + '">' + statusLabel + "</span>" +
        "</div>" +
        '<p class="stage-card-description">' + escapeHtml(stage.description) + "</p>" +
        '<div class="stage-card-meta">' +
        "<span>플라스크 " + stage.flaskCount + "개 · 색상 " + stage.colors + "종</span>" +
        "<span>" + bestLine + "</span>" +
        "</div>" +
        '<button class="stage-button" type="button" data-stage-id="' + stage.id + '"' + (unlocked ? "" : " disabled") + ">" +
        (result.cleared ? "다시 플레이" : unlocked ? "이 스테이지 시작" : "잠금 해제 필요") +
        "</button>" +
        "</article>"
      );
    }).join("");
  }

  function renderBoard() {
    var run = state.currentRun;
    var stage = getCurrentStage();
    var moveData = state.recentMove || {};

    els.board.className = "board-grid board-" + stage.flaskCount;
    els.board.innerHTML = run.board.map(function (tube, index) {
      var classes = ["tube"];

      if (state.selectedTubeIndex === index) {
        classes.push("is-selected");
      }
      if (state.validTargets.indexOf(index) !== -1) {
        classes.push("is-valid-target");
      }
      if (state.invalidTubes.indexOf(index) !== -1) {
        classes.push("is-invalid");
      }
      if (moveData.source === index) {
        classes.push("is-pour-source");
      }
      if (moveData.target === index) {
        classes.push("is-pour-target");
      }
      if (run.activeHint && run.activeHint.source === index) {
        classes.push("is-hint-source");
      }
      if (run.activeHint && run.activeHint.target === index) {
        classes.push("is-hint-target");
      }
      if (isTubeComplete(tube, stage.capacity)) {
        classes.push("is-complete");
      }

      return (
        '<div class="' + classes.join(" ") + '">' +
        '<button class="tube-button" type="button" data-tube-index="' + index + '">' +
        '<span class="tube-index">' + (index + 1) + "번</span>" +
        '<span class="tube-badge">정렬 완료</span>' +
        '<span class="tube-stack">' + buildTubeStackHtml(tube, stage.capacity) + "</span>" +
        "</button>" +
        "</div>"
      );
    }).join("");
  }

  function buildTubeStackHtml(tube, capacity) {
    var html = "";
    var i;

    for (i = 0; i < capacity; i += 1) {
      if (tube[i]) {
        html += '<span class="liquid-layer" style="' + buildLayerStyle(tube[i]) + '"></span>';
      } else {
        html += '<span class="tube-slot"></span>';
      }
    }
    return html;
  }

  function buildLayerStyle(colorKey) {
    var hex = getColorHex(colorKey);
    var topHex = adjustHexColor(hex, 18);
    var bottomHex = adjustHexColor(hex, -18);
    return (
      "background: linear-gradient(180deg, " +
      topHex +
      " 0%, " +
      hex +
      " 58%, " +
      bottomHex +
      " 100%);" +
      " box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -8px 14px rgba(0,0,0,0.1), 0 8px 18px " +
      toRgba(hex, 0.22) +
      ";"
    );
  }

  function renderGameNotice() {
    if (!state.notice || state.screen !== "game") {
      els.gameNotice.className = "notice-banner is-hidden";
      els.gameNotice.textContent = "";
      return;
    }
    els.gameNotice.className = "notice-banner " + (state.notice.type || "");
    els.gameNotice.textContent = state.notice.text;
  }

  function updateGameControls() {
    var run = state.currentRun;

    els.hintButton.disabled = !run || run.hintsRemaining <= 0 || state.solvingHint;
    els.undoButton.disabled = !run || !run.history.length;
    els.restartButton.disabled = !run;
    els.giveUpButton.disabled = !run;
    els.hintButton.textContent = state.solvingHint ? "힌트 계산 중..." : "힌트";
  }

  // Interaction handlers
  function onDifficultySelectorClick(event) {
    var button = event.target.closest("[data-difficulty]");
    if (!button) {
      return;
    }
    var difficultyKey = button.getAttribute("data-difficulty");
    var availableCounts = getAvailableCountsForDifficulty(difficultyKey);

    state.selectedDifficulty = difficultyKey;
    if (
      state.selectedFlaskCount !== "all" &&
      availableCounts.indexOf(Number(state.selectedFlaskCount)) === -1
    ) {
      state.selectedFlaskCount = "all";
    }
    saveState();
    renderLobby();
  }

  function onFlaskSelectorClick(event) {
    var button = event.target.closest("[data-flask-count]");
    if (!button || button.classList.contains("is-disabled")) {
      return;
    }
    state.selectedFlaskCount = button.getAttribute("data-flask-count");
    saveState();
    renderLobby();
  }

  function onStageListClick(event) {
    var button = event.target.closest("[data-stage-id]");
    if (!button) {
      return;
    }
    var stageId = button.getAttribute("data-stage-id");
    var stage = stageMap[stageId];
    if (!stage) {
      return;
    }
    if (!isStageUnlocked(stage)) {
      showToast("이전 스테이지를 먼저 완료해야 열립니다.");
      return;
    }
    startStage(stageId);
  }

  function onBoardClick(event) {
    var button = event.target.closest("[data-tube-index]");
    if (!button || !state.currentRun || state.solvingHint) {
      return;
    }
    handleTubeSelection(Number(button.getAttribute("data-tube-index")));
  }

  function onModalBackdropClick(event) {
    if (event.target === els.modalBackdrop && state.modal && state.modal.dismissible !== false) {
      closeModal();
    }
  }

  function onModalActionClick(event) {
    var button = event.target.closest("[data-modal-action]");
    if (!button) {
      return;
    }
    handleModalAction(button.getAttribute("data-modal-action"));
  }

  function onModalBodyClick(event) {
    var toggle = event.target.closest("[data-setting-toggle]");
    var motion = event.target.closest("[data-setting-motion]");

    if (toggle) {
      var key = toggle.getAttribute("data-setting-toggle");
      if (key === "haptics" || key === "bgm" || key === "sfx") {
        state.settings[key] = !state.settings[key];
        applySettings();
        saveState();
        openSettingsModal();
      }
      return;
    }

    if (motion) {
      var motionKey = motion.getAttribute("data-setting-motion");
      if (MOTION_SCALE_MAP[motionKey]) {
        state.settings.motion = motionKey;
        applySettings();
        saveState();
        openSettingsModal();
      }
    }
  }

  function startSuggestedStage() {
    var stage = getSuggestedStage();
    if (!stage) {
      showToast("현재 선택에는 시작 가능한 스테이지가 없습니다.");
      return;
    }
    startStage(stage.id);
  }

  function startStage(stageId) {
    var stage = stageMap[stageId];

    if (!stage) {
      return;
    }

    pauseGameTimer();
    state.hintRequestId += 1;
    state.solvingHint = false;
    celebration.stop();
    markAttempt(stageId);

    state.currentRun = {
      stageId: stageId,
      board: cloneBoard(stage.tubes),
      history: [],
      moveCount: 0,
      elapsedMs: 0,
      hintsRemaining: stage.hintLimit,
      activeHint: null
    };

    clearSelection();
    state.notice = null;
    state.recentMove = null;
    state.invalidTubes = [];
    state.screen = "game";
    closeModal();
    saveState();
    renderCurrentScreen();
    startGameTimer(true);
  }

  function resumeCurrentRun() {
    if (!state.currentRun || !stageMap[state.currentRun.stageId]) {
      goToLobby(true);
      return;
    }

    celebration.stop();
    state.screen = "game";
    closeModal();
    renderCurrentScreen();
    startGameTimer();
  }

  // Game state transitions
  function goToLobby(shouldOfferTutorial) {
    pauseGameTimer();
    state.hintRequestId += 1;
    state.solvingHint = false;
    celebration.stop();
    clearSelection();
    closeModal();
    clearNotice(false);
    state.screen = "lobby";
    saveState();
    renderCurrentScreen();

    if (shouldOfferTutorial && !state.hasSeenTutorial) {
      openTutorial();
    }
  }

  function handleTubeSelection(index) {
    var run = state.currentRun;
    var stage = getCurrentStage();
    var sourceIndex = state.selectedTubeIndex;
    var clickedTube = run.board[index];
    var clickedTargets = clickedTube.length ? getValidTargets(run.board, index, stage.capacity) : [];

    clearNotice(false);

    if (sourceIndex === null) {
      if (!clickedTube.length) {
        showInvalidFeedback([index], "비어 있는 플라스크는 출발점으로 선택할 수 없어요.");
        return;
      }
      if (!clickedTargets.length) {
        showInvalidFeedback([index], "이 플라스크는 지금 옮길 곳이 없어요.");
        return;
      }
      state.selectedTubeIndex = index;
      state.validTargets = clickedTargets;
      run.activeHint = null;
      vibratePattern("select");
      renderGame();
      return;
    }

    if (sourceIndex === index) {
      clearSelection();
      renderGame();
      return;
    }

    if (canMove(run.board, sourceIndex, index, stage.capacity)) {
      makeMove(sourceIndex, index);
      return;
    }

    if (clickedTube.length && clickedTargets.length) {
      showInvalidFeedback([index], "여기로는 옮길 수 없어요. 대신 새 출발 플라스크로 바꿨어요.");
      state.selectedTubeIndex = index;
      state.validTargets = clickedTargets;
      renderGame();
      return;
    }

    showInvalidFeedback([index], "이동 규칙에 맞지 않는 조합입니다.");
  }

  function makeMove(sourceIndex, targetIndex) {
    var run = state.currentRun;
    var stage = getCurrentStage();
    var block = getTopBlock(run.board[sourceIndex]);

    if (!block || !canMove(run.board, sourceIndex, targetIndex, stage.capacity)) {
      showInvalidFeedback([sourceIndex, targetIndex], "이동할 수 없는 조합입니다.");
      return;
    }

    pauseGameTimer();
    run.history.push({
      board: cloneBoard(run.board),
      moveCount: run.moveCount,
      elapsedMs: run.elapsedMs,
      hintsRemaining: run.hintsRemaining
    });

    run.board = moveBlock(run.board, sourceIndex, targetIndex, block.count);
    run.moveCount += 1;
    run.activeHint = null;
    state.recentMove = { source: sourceIndex, target: targetIndex };
    clearSelection();

    saveState();
    renderGame();
    startGameTimer();
    pulseRecentMove();
    setNotice((sourceIndex + 1) + "번 → " + (targetIndex + 1) + "번으로 " + block.count + "칸 이동", "success");
    audioEngine.playSfx("move");
    vibratePattern("success");

    if (isBoardSolved(run.board, stage.capacity)) {
      handleStageClear();
    }
  }

  function undoMove() {
    var run = state.currentRun;
    var snapshot;

    if (!run || !run.history.length) {
      return;
    }

    pauseGameTimer();
    snapshot = run.history.pop();
    run.board = cloneBoard(snapshot.board);
    run.moveCount = snapshot.moveCount;
    run.elapsedMs = snapshot.elapsedMs;
    run.hintsRemaining = snapshot.hintsRemaining;
    run.activeHint = null;
    state.recentMove = null;
    state.invalidTubes = [];
    clearSelection();

    saveState();
    renderGame();
    startGameTimer();
    setNotice("방금 이동을 되돌렸어요.", "success");
  }

  function requestHint() {
    var run = state.currentRun;
    var stage = getCurrentStage();
    var requestId;
    var boardSnapshot;
    var path;

    if (!run || !stage || run.hintsRemaining <= 0 || state.solvingHint) {
      return;
    }

    state.solvingHint = true;
    state.hintRequestId += 1;
    requestId = state.hintRequestId;
    boardSnapshot = cloneBoard(run.board);
    clearSelection();
    setNotice("현재 상태에서 실제 해결 경로를 계산하는 중입니다...", "success", true);
    renderGame();

    window.setTimeout(function () {
      path = solveBoard(boardSnapshot, stage.capacity, stage.flaskCount >= 20 ? 120000 : 60000);

      if (
        requestId !== state.hintRequestId ||
        !state.currentRun ||
        state.currentRun.stageId !== stage.id ||
        state.screen !== "game"
      ) {
        return;
      }

      state.solvingHint = false;

      if (!path || !path.length) {
        setNotice("힌트를 계산하지 못했어요. 한 수 되돌린 뒤 다시 시도해 보세요.", "warning", true);
        audioEngine.playSfx("invalid");
        renderGame();
        return;
      }

      run.hintsRemaining -= 1;
      run.activeHint = {
        source: path[0].source,
        target: path[0].target
      };
      state.selectedTubeIndex = path[0].source;
      state.validTargets = getValidTargets(run.board, path[0].source, stage.capacity);
      saveState();
      renderGame();
      setNotice("추천 이동: " + (path[0].source + 1) + "번 → " + (path[0].target + 1) + "번", "success", true);
      audioEngine.playSfx("hint");
      vibratePattern("hint");
    }, 28);
  }

  function confirmRestartStage() {
    if (!state.currentRun) {
      return;
    }
    openModal({
      title: "현재 스테이지를 다시 시작할까요?",
      body:
        '<div class="modal-stack">' +
        '<div class="modal-chip"><p class="modal-copy">지금까지의 이동, 힌트, 시간 기록은 초기 상태로 되돌아갑니다. 이어하기 데이터도 이 스테이지의 시작 상태로 덮어써집니다.</p></div>' +
        "</div>",
      actions: [
        { id: "close", label: "계속 플레이" },
        { id: "restart-stage", label: "다시 시작", primary: true }
      ]
    });
  }

  function confirmGiveUp() {
    if (!state.currentRun) {
      return;
    }
    openModal({
      title: "이번 도전을 포기할까요?",
      body:
        '<div class="modal-stack">' +
        '<div class="modal-chip"><p class="modal-copy">포기하면 이번 도전은 실패로 기록됩니다. 바로 다시 도전하거나, 로비로 돌아가 다른 스테이지를 고를 수 있습니다.</p></div>' +
        "</div>",
      actions: [
        { id: "close", label: "계속 플레이" },
        { id: "give-up-retry", label: "다시 도전", primary: true },
        { id: "give-up-lobby", label: "로비로 이동", danger: true }
      ]
    });
  }

  function handleStageClear() {
    var run = state.currentRun;
    var stage = getCurrentStage();
    var nextStage;
    var summary;

    if (!run || !stage) {
      return;
    }

    pauseGameTimer();
    audioEngine.playSfx("clear");
    vibratePattern("clear");
    celebration.start();

    nextStage = getNextStage(stage);
    summary = {
      stageId: stage.id,
      title: stage.title,
      difficulty: stage.difficulty,
      moveCount: run.moveCount,
      elapsedMs: run.elapsedMs,
      globalOrder: stage.globalOrder,
      nextStageId: nextStage ? nextStage.id : null,
      difficultyCompleted: isDifficultyFullyCleared(stage.difficulty, stage.id),
      allCompleted: getOverallStatsAfterClear(stage.id).cleared === APP_DATA.stages.length
    };

    markClear(stage.id, run.moveCount, run.elapsedMs);
    state.currentRun = null;
    state.recentMove = null;
    state.solvingHint = false;
    state.hintRequestId += 1;
    clearSelection();
    saveState();
    state.screen = "lobby";
    renderCurrentScreen();
    openClearModal(summary);
  }

  function handleModalAction(actionId) {
    var modalPayload = state.modal && state.modal.payload ? state.modal.payload : null;

    if (actionId === "close") {
      closeModal();
      return;
    }

    if (actionId === "restart-stage" && state.currentRun) {
      closeModal();
      startStage(state.currentRun.stageId);
      return;
    }

    if (actionId === "give-up-retry" && state.currentRun) {
      markFailure(state.currentRun.stageId);
      closeModal();
      startStage(state.currentRun.stageId);
      return;
    }

    if (actionId === "give-up-lobby" && state.currentRun) {
      markFailure(state.currentRun.stageId);
      state.currentRun = null;
      closeModal();
      goToLobby(false);
      showToast("포기 기록을 남기고 로비로 돌아왔어요.");
      return;
    }

    if (actionId === "next-stage" && modalPayload && modalPayload.nextStageId) {
      closeModal();
      startStage(modalPayload.nextStageId);
      return;
    }

    if (actionId === "replay-stage" && modalPayload && modalPayload.stageId) {
      closeModal();
      startStage(modalPayload.stageId);
      return;
    }

    if (actionId === "go-lobby") {
      closeModal();
      goToLobby(false);
      return;
    }

    if (actionId === "view-records") {
      openRecordsModal();
    }
  }

  // Settings, help, and records overlays
  function openHelpModal() {
    openModal({
      title: "게임 규칙",
      body:
        '<div class="help-list">' +
        '<article class="help-card"><h3>기본 이동 규칙</h3><p>맨 위에 연속으로 이어진 같은 색 블록만 한 번에 이동할 수 있습니다. 목적지 플라스크는 비어 있거나 같은 색 위여야 합니다.</p></article>' +
        '<article class="help-card"><h3>정렬 완료 조건</h3><p>플라스크가 완전히 비어 있거나, 한 가지 색으로 가득 차 있으면 완료 상태입니다. 완료된 플라스크는 배지와 글로우로 강조됩니다.</p></article>' +
        '<article class="help-card"><h3>도움 기능</h3><p>힌트는 현재 보드에서 실제 해결 경로를 계산해 다음 한 수를 보여줍니다. 되돌리기와 재시작, 포기 후 재도전도 모두 지원합니다.</p></article>' +
        '<article class="help-card"><h3>PWA 설치</h3><p>iPhone은 Safari의 공유 메뉴, Android는 Chrome 메뉴에서 홈 화면에 추가하면 앱처럼 실행할 수 있습니다.</p></article>' +
        "</div>",
      actions: [
        { id: "close", label: "닫기", primary: true }
      ]
    });
  }

  function openSettingsModal() {
    openModal({
      title: "설정",
      body:
        '<div class="settings-list">' +
        '<article class="setting-card">' +
        '<div class="settings-row">' +
        '<div class="settings-copy"><h3>햅틱 반응</h3><p>이동 성공, 실패, 클리어 상황에 짧은 진동 피드백을 보냅니다.</p></div>' +
        buildToggleButton("haptics", state.settings.haptics) +
        "</div>" +
        '<div class="settings-row">' +
        '<div class="settings-copy"><h3>배경음악</h3><p>최초 터치 이후 은은한 루프 BGM이 재생됩니다. 브라우저 정책을 자동으로 따릅니다.</p></div>' +
        buildToggleButton("bgm", state.settings.bgm) +
        "</div>" +
        '<div class="settings-row">' +
        '<div class="settings-copy"><h3>효과음</h3><p>이동 성공, 실패, 힌트, 클리어 사운드를 각각 재생합니다.</p></div>' +
        buildToggleButton("sfx", state.settings.sfx) +
        "</div>" +
        "</article>" +
        '<article class="setting-card">' +
        '<div class="settings-copy"><h3>애니메이션 강도</h3><p>전체 전환 속도와 연출 밀도를 조절합니다.</p></div>' +
        '<div class="segmented">' +
        buildMotionButton("calm", "차분") +
        buildMotionButton("standard", "표준") +
        buildMotionButton("vivid", "강하게") +
        "</div>" +
        "</article>" +
        '<article class="setting-card">' +
        '<div class="settings-copy"><h3>앱 정보</h3><p>' +
        APP_DATA.app.name +
        " · 버전 " +
        APP_DATA.version +
        "<br>현재 사운드는 가벼운 Web Audio 합성 방식으로 동작하며, 나중에 assets/audio 폴더의 커스텀 파일로 교체할 수 있습니다.</p></div>" +
        "</article>" +
        "</div>",
      actions: [
        { id: "close", label: "닫기", primary: true }
      ]
    });
  }

  function openRecordsModal() {
    var overall = getOverallStats();
    var body = '<div class="record-list">';

    body +=
      '<article class="record-card">' +
      '<h3>전체 진행률</h3>' +
      '<p class="record-subcopy">' + buildProgressNarrative() + "</p>" +
      '<div class="progress-track" style="margin-top:12px;"><div class="progress-fill" style="width:' + ((overall.cleared / overall.total) * 100).toFixed(1) + '%;"></div></div>' +
      "</article>";

    APP_DATA.difficulties.forEach(function (difficulty) {
      var stats = getDifficultyStats(difficulty.key);

      body += '<article class="record-card">';
      body += '<h3>' + difficulty.label + " " + stats.cleared + "/" + stats.total + "</h3>";
      body += '<p class="record-subcopy">' + difficulty.description + "</p>";

      getStagesByDifficulty(difficulty.key).forEach(function (stage) {
        var result = getStageResult(stage.id);
        var badgeClass = result.cleared ? " complete" : isStageUnlocked(stage) ? "" : " locked";
        var badgeText = result.cleared ? "완료" : isStageUnlocked(stage) ? "도전 가능" : "잠김";
        var line = result.cleared && result.bestTimeMs !== null
          ? "베스트 " + result.bestMoves + "회 · " + formatTime(result.bestTimeMs)
          : "기준 이동 " + stage.par + "회";

        body +=
          '<div class="record-row">' +
          '<div><strong>' + stage.order + ". " + escapeHtml(stage.title) + '</strong><div class="record-subcopy">' + line + "</div></div>" +
          '<span class="record-badge' + badgeClass + '">' + badgeText + "</span>" +
          "</div>";
      });

      body += "</article>";
    });

    body += "</div>";

    openModal({
      title: "클리어 기록",
      body: body,
      actions: [
        { id: "close", label: "닫기", primary: true }
      ]
    });
  }

  function openClearModal(summary) {
    var message = "축하합니다! " + APP_DATA.stages.length + "개 중 " + summary.globalOrder + "번째 스테이지를 완료했어요.";
    var detail = "기록: " + summary.moveCount + "회 이동 · " + formatTime(summary.elapsedMs);
    var actions = [];

    if (summary.difficultyCompleted) {
      detail += " · " + getDifficultyLabel(summary.difficulty) + " 난이도 완료";
    }
    if (summary.allCompleted) {
      detail += " · 모든 테스트 스테이지 완료";
    }

    if (summary.nextStageId) {
      actions.push({
        id: "next-stage",
        label: summary.difficultyCompleted ? "다음 난이도 시작" : "다음 스테이지",
        primary: true
      });
    }
    actions.push({
      id: summary.allCompleted ? "view-records" : "replay-stage",
      label: summary.allCompleted ? "기록 보기" : "한 번 더",
      primary: !summary.nextStageId
    });
    actions.push({ id: "go-lobby", label: "로비로 가기" });

    openModal({
      title: "Stage Clear",
      body:
        '<div class="modal-stack">' +
        '<article class="modal-chip"><h3>Brilliant Clear</h3><p class="modal-copy">' + escapeHtml(message) + "</p></article>" +
        '<article class="modal-chip"><h3>현재 기록</h3><p class="modal-copy">' + escapeHtml(detail) + "</p></article>" +
        "</div>",
      actions: actions,
      payload: summary
    });
  }

  function openModal(config) {
    state.modal = config || null;
    renderModal();
  }

  function closeModal() {
    state.modal = null;
    renderModal();
  }

  function renderModal() {
    if (!state.modal) {
      els.modalBackdrop.hidden = true;
      els.modalTitle.textContent = "";
      els.modalBody.innerHTML = "";
      els.modalActions.innerHTML = "";
      return;
    }

    els.modalBackdrop.hidden = false;
    els.modalTitle.textContent = state.modal.title || "안내";
    els.modalBody.innerHTML = state.modal.body || "";
    els.modalActions.innerHTML = (state.modal.actions || []).map(function (action) {
      var className = "modal-button";
      if (action.primary) {
        className += " modal-button--primary";
      }
      if (action.danger) {
        className += " modal-button--danger";
      }
      return '<button class="' + className + '" type="button" data-modal-action="' + action.id + '">' + action.label + "</button>";
    }).join("");
  }

  function buildToggleButton(key, enabled) {
    return '<button class="toggle-button' + (enabled ? " is-on" : "") + '" type="button" data-setting-toggle="' + key + '">' + (enabled ? "켜짐" : "꺼짐") + "</button>";
  }

  function buildMotionButton(key, label) {
    return '<button class="segment-button' + (state.settings.motion === key ? " is-selected" : "") + '" type="button" data-setting-motion="' + key + '">' + label + "</button>";
  }

  function openTutorial() {
    state.tutorialOpen = true;
    state.tutorialStep = 0;
    renderTutorial();
  }

  function closeTutorial() {
    state.tutorialOpen = false;
    state.hasSeenTutorial = true;
    saveState();
    renderTutorial();
  }

  function advanceTutorial() {
    if (state.tutorialStep >= TUTORIAL_STEPS.length - 1) {
      closeTutorial();
      return;
    }
    state.tutorialStep += 1;
    renderTutorial();
  }

  function renderTutorial() {
    var step = TUTORIAL_STEPS[state.tutorialStep];

    if (!state.tutorialOpen) {
      els.tutorialOverlay.hidden = true;
      return;
    }

    els.tutorialOverlay.hidden = false;
    els.tutorialStepLabel.textContent = step.label;
    els.tutorialTitle.textContent = step.title;
    els.tutorialDescription.textContent = step.description;
    els.tutorialNextButton.textContent = state.tutorialStep === TUTORIAL_STEPS.length - 1 ? "시작하기" : "다음";
    els.tutorialDots.innerHTML = TUTORIAL_STEPS.map(function (_, index) {
      return '<span class="tutorial-dot' + (index === state.tutorialStep ? " is-active" : "") + '"></span>';
    }).join("");
  }

  // Timer and feedback helpers
  function startGameTimer(forceRestart) {
    if (!state.currentRun) {
      return;
    }
    if (forceRestart) {
      pauseGameTimer();
      state.currentRun.elapsedMs = state.currentRun.elapsedMs || 0;
    }
    if (state.timerStartedAt) {
      return;
    }
    state.timerStartedAt = Date.now();
    clearInterval(state.timerId);
    state.timerId = window.setInterval(function () {
      if (state.screen === "game" && state.currentRun) {
        els.timerText.textContent = formatTime(getElapsedMs());
      }
    }, 1000);
  }

  function pauseGameTimer() {
    if (!state.currentRun || !state.timerStartedAt) {
      clearInterval(state.timerId);
      state.timerStartedAt = 0;
      return;
    }
    state.currentRun.elapsedMs = getElapsedMs();
    state.timerStartedAt = 0;
    clearInterval(state.timerId);
  }

  function getElapsedMs() {
    if (!state.currentRun) {
      return 0;
    }
    if (!state.timerStartedAt) {
      return state.currentRun.elapsedMs || 0;
    }
    return state.currentRun.elapsedMs + (Date.now() - state.timerStartedAt);
  }

  function pulseRecentMove() {
    clearTimeout(state.movePulseId);
    state.movePulseId = window.setTimeout(function () {
      state.recentMove = null;
      if (state.screen === "game") {
        renderGame();
      }
    }, Math.round(420 * getMotionScale()));
  }

  function showInvalidFeedback(indices, message) {
    state.invalidTubes = indices.slice();
    clearSelection();
    setNotice(message, "danger");
    audioEngine.playSfx("invalid");
    vibratePattern("invalid");
    renderGame();

    clearTimeout(state.invalidClearId);
    state.invalidClearId = window.setTimeout(function () {
      state.invalidTubes = [];
      if (state.screen === "game") {
        renderGame();
      }
    }, Math.round(360 * getMotionScale()));
  }

  function clearSelection() {
    state.selectedTubeIndex = null;
    state.validTargets = [];
    if (state.currentRun) {
      state.currentRun.activeHint = null;
    }
  }

  function setNotice(text, type, sticky) {
    clearTimeout(state.noticeId);
    state.notice = {
      text: text,
      type: type || "success"
    };
    renderGameNotice();
    if (!sticky) {
      state.noticeId = window.setTimeout(function () {
        clearNotice(true);
      }, 2600);
    }
  }

  function clearNotice(shouldRender) {
    clearTimeout(state.noticeId);
    state.notice = null;
    if (shouldRender !== false) {
      renderGameNotice();
    }
  }

  function showToast(text) {
    clearTimeout(state.toastId);
    clearTimeout(state.toastHideId);
    els.toast.textContent = text;
    els.toast.hidden = false;
    window.requestAnimationFrame(function () {
      els.toast.classList.add("is-visible");
    });
    state.toastId = window.setTimeout(function () {
      els.toast.classList.remove("is-visible");
      state.toastHideId = window.setTimeout(function () {
        els.toast.hidden = true;
      }, 220);
    }, 2200);
  }

  // Persistence
  function loadState() {
    var raw = safeStorageRead(STORAGE_KEY);

    if (!raw) {
      return;
    }

    if (difficultyMap[raw.selectedDifficulty]) {
      state.selectedDifficulty = raw.selectedDifficulty;
    }
    if (raw.selectedFlaskCount === "all" || APP_DATA.flaskOptions.indexOf(Number(raw.selectedFlaskCount)) !== -1) {
      state.selectedFlaskCount = raw.selectedFlaskCount;
    }
    if (raw.settings) {
      state.settings.haptics = Boolean(raw.settings.haptics);
      state.settings.bgm = Boolean(raw.settings.bgm);
      state.settings.sfx = Boolean(raw.settings.sfx);
      state.settings.motion = MOTION_SCALE_MAP[raw.settings.motion] ? raw.settings.motion : DEFAULT_SETTINGS.motion;
    }
    state.hasSeenTutorial = Boolean(raw.hasSeenTutorial);
    state.results = sanitizeResults(raw.results);
    state.currentRun = sanitizeRun(raw.currentRun);
  }

  function saveState() {
    safeStorageWrite(STORAGE_KEY, {
      selectedDifficulty: state.selectedDifficulty,
      selectedFlaskCount: state.selectedFlaskCount,
      settings: state.settings,
      hasSeenTutorial: state.hasSeenTutorial,
      results: state.results,
      currentRun: serializeCurrentRun()
    });
  }

  function serializeCurrentRun() {
    if (!state.currentRun) {
      return null;
    }
    return {
      stageId: state.currentRun.stageId,
      board: cloneBoard(state.currentRun.board),
      history: state.currentRun.history.map(function (entry) {
        return {
          board: cloneBoard(entry.board),
          moveCount: entry.moveCount,
          elapsedMs: entry.elapsedMs,
          hintsRemaining: entry.hintsRemaining
        };
      }),
      moveCount: state.currentRun.moveCount,
      elapsedMs: getElapsedMs(),
      hintsRemaining: state.currentRun.hintsRemaining
    };
  }

  function sanitizeResults(results) {
    var clean = {};

    if (!results) {
      return clean;
    }

    Object.keys(results).forEach(function (stageId) {
      if (!stageMap[stageId]) {
        return;
      }
      clean[stageId] = {
        cleared: Boolean(results[stageId].cleared),
        bestMoves: isFiniteNumber(results[stageId].bestMoves) ? results[stageId].bestMoves : null,
        bestTimeMs: isFiniteNumber(results[stageId].bestTimeMs) ? results[stageId].bestTimeMs : null,
        attempts: isFiniteNumber(results[stageId].attempts) ? results[stageId].attempts : 0,
        fails: isFiniteNumber(results[stageId].fails) ? results[stageId].fails : 0,
        completedAt: isFiniteNumber(results[stageId].completedAt) ? results[stageId].completedAt : null
      };
    });

    return clean;
  }

  function sanitizeRun(run) {
    var stage;
    var board = [];
    var history = [];
    var i;
    var j;

    if (!run || !stageMap[run.stageId]) {
      return null;
    }

    stage = stageMap[run.stageId];

    if (!Array.isArray(run.board) || run.board.length !== stage.flaskCount) {
      return null;
    }

    for (i = 0; i < run.board.length; i += 1) {
      if (!Array.isArray(run.board[i]) || run.board[i].length > stage.capacity) {
        return null;
      }
      board.push([]);
      for (j = 0; j < run.board[i].length; j += 1) {
        if (!APP_DATA.palette[run.board[i][j]]) {
          return null;
        }
        board[i].push(run.board[i][j]);
      }
    }

    if (Array.isArray(run.history)) {
      run.history.forEach(function (entry) {
        if (!entry || !Array.isArray(entry.board)) {
          return;
        }
        history.push({
          board: cloneBoard(entry.board),
          moveCount: isFiniteNumber(entry.moveCount) ? entry.moveCount : 0,
          elapsedMs: isFiniteNumber(entry.elapsedMs) ? entry.elapsedMs : 0,
          hintsRemaining: isFiniteNumber(entry.hintsRemaining) ? entry.hintsRemaining : stage.hintLimit
        });
      });
    }

    return {
      stageId: run.stageId,
      board: board,
      history: history,
      moveCount: isFiniteNumber(run.moveCount) ? run.moveCount : 0,
      elapsedMs: isFiniteNumber(run.elapsedMs) ? run.elapsedMs : 0,
      hintsRemaining: isFiniteNumber(run.hintsRemaining) ? run.hintsRemaining : stage.hintLimit,
      activeHint: null
    };
  }

  function safeStorageRead(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function safeStorageWrite(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (!state.storageWarned) {
        state.storageWarned = true;
        showToast("저장 공간에 접근할 수 없어 이어하기가 제한될 수 있어요.");
      }
      return false;
    }
  }

  // Stage and progress helpers
  function markAttempt(stageId) {
    var result = getStageResult(stageId);
    result.attempts += 1;
    state.results[stageId] = result;
  }

  function markFailure(stageId) {
    var result = getStageResult(stageId);
    result.fails += 1;
    state.results[stageId] = result;
    saveState();
  }

  function markClear(stageId, moveCount, elapsedMs) {
    var result = getStageResult(stageId);
    result.cleared = true;
    result.completedAt = Date.now();
    result.bestMoves = result.bestMoves === null ? moveCount : Math.min(result.bestMoves, moveCount);
    result.bestTimeMs = result.bestTimeMs === null ? elapsedMs : Math.min(result.bestTimeMs, elapsedMs);
    state.results[stageId] = result;
  }

  function getStageResult(stageId) {
    if (!state.results[stageId]) {
      state.results[stageId] = {
        cleared: false,
        bestMoves: null,
        bestTimeMs: null,
        attempts: 0,
        fails: 0,
        completedAt: null
      };
    }
    return state.results[stageId];
  }

  function getVisibleStages() {
    return getStagesByDifficulty(state.selectedDifficulty).filter(function (stage) {
      return state.selectedFlaskCount === "all" || stage.flaskCount === Number(state.selectedFlaskCount);
    });
  }

  function getStagesByDifficulty(difficultyKey) {
    return APP_DATA.stages.filter(function (stage) {
      return stage.difficulty === difficultyKey;
    });
  }

  function getAvailableCountsForDifficulty(difficultyKey) {
    var counts = [];
    getStagesByDifficulty(difficultyKey).forEach(function (stage) {
      if (counts.indexOf(stage.flaskCount) === -1) {
        counts.push(stage.flaskCount);
      }
    });
    return counts.sort(function (a, b) {
      return a - b;
    });
  }

  function getDifficultyStats(difficultyKey) {
    var stages = getStagesByDifficulty(difficultyKey);
    var cleared = stages.filter(function (stage) {
      return getStageResult(stage.id).cleared;
    }).length;
    return {
      total: stages.length,
      cleared: cleared
    };
  }

  function getCurrentStageForDifficulty(difficultyKey) {
    var stages = getStagesByDifficulty(difficultyKey);
    var i;
    for (i = 0; i < stages.length; i += 1) {
      if (!getStageResult(stages[i].id).cleared) {
        return stages[i];
      }
    }
    return stages[stages.length - 1] || null;
  }

  function getSuggestedStage() {
    var visibleStages = getVisibleStages();
    var i;

    for (i = 0; i < visibleStages.length; i += 1) {
      if (isStageUnlocked(visibleStages[i]) && !getStageResult(visibleStages[i].id).cleared) {
        return visibleStages[i];
      }
    }

    for (i = 0; i < visibleStages.length; i += 1) {
      if (isStageUnlocked(visibleStages[i])) {
        return visibleStages[i];
      }
    }

    return null;
  }

  function getOverallStats() {
    var cleared = APP_DATA.stages.filter(function (stage) {
      return getStageResult(stage.id).cleared;
    }).length;
    return {
      total: APP_DATA.stages.length,
      cleared: cleared
    };
  }

  function getOverallStatsAfterClear(stageId) {
    var overall = getOverallStats();
    if (!getStageResult(stageId).cleared) {
      overall.cleared += 1;
    }
    return overall;
  }

  function buildProgressNarrative() {
    var parts = [];
    var activeShown = false;

    APP_DATA.difficulties.forEach(function (difficulty) {
      var stats = getDifficultyStats(difficulty.key);
      var text = difficulty.label + " " + stats.cleared + "/" + stats.total;

      if (stats.cleared === stats.total) {
        text += " 완료";
      } else if (!activeShown) {
        text += " 진행 중";
        activeShown = true;
      }
      parts.push(text);
    });

    return parts.join(", ");
  }

  function isStageUnlocked(stage) {
    var stages = getStagesByDifficulty(stage.difficulty);
    var previousStage;

    if (stage.order === 1) {
      return true;
    }

    previousStage = stages[stage.order - 2];
    return previousStage ? getStageResult(previousStage.id).cleared : true;
  }

  function isDifficultyFullyCleared(difficultyKey, justClearedStageId) {
    return getStagesByDifficulty(difficultyKey).every(function (stage) {
      return stage.id === justClearedStageId || getStageResult(stage.id).cleared;
    });
  }

  function getNextStage(stage) {
    var difficultyStages = getStagesByDifficulty(stage.difficulty);
    var nextInDifficulty = difficultyStages[stage.order];
    var difficultyIndex;

    if (nextInDifficulty) {
      return nextInDifficulty;
    }

    difficultyIndex = APP_DATA.difficulties.findIndex(function (item) {
      return item.key === stage.difficulty;
    });

    if (difficultyIndex === -1 || difficultyIndex === APP_DATA.difficulties.length - 1) {
      return null;
    }

    return getStagesByDifficulty(APP_DATA.difficulties[difficultyIndex + 1].key)[0] || null;
  }

  function getCurrentStage() {
    return state.currentRun ? stageMap[state.currentRun.stageId] : null;
  }

  function getDifficultyLabel(key) {
    return difficultyMap[key] ? difficultyMap[key].label : "";
  }

  function canMove(board, sourceIndex, targetIndex, capacity) {
    var sourceTube;
    var targetTube;
    var block;

    if (sourceIndex === targetIndex) {
      return false;
    }

    sourceTube = board[sourceIndex];
    targetTube = board[targetIndex];

    if (!sourceTube.length || targetTube.length >= capacity) {
      return false;
    }

    block = getTopBlock(sourceTube);
    if (!block) {
      return false;
    }

    if (targetTube.length && targetTube[targetTube.length - 1] !== block.color) {
      return false;
    }

    return capacity - targetTube.length >= block.count;
  }

  function getValidTargets(board, sourceIndex, capacity) {
    var targets = [];
    var i;
    for (i = 0; i < board.length; i += 1) {
      if (canMove(board, sourceIndex, i, capacity)) {
        targets.push(i);
      }
    }
    return targets;
  }

  function getTopBlock(tube) {
    var color;
    var count = 1;
    var i;

    if (!tube || !tube.length) {
      return null;
    }

    color = tube[tube.length - 1];
    for (i = tube.length - 2; i >= 0; i -= 1) {
      if (tube[i] !== color) {
        break;
      }
      count += 1;
    }
    return { color: color, count: count };
  }

  function moveBlock(board, sourceIndex, targetIndex, count) {
    var nextBoard = cloneBoard(board);
    var i;
    for (i = 0; i < count; i += 1) {
      nextBoard[targetIndex].push(nextBoard[sourceIndex].pop());
    }
    return nextBoard;
  }

  function isBoardSolved(board, capacity) {
    return board.every(function (tube) {
      return !tube.length || isTubeComplete(tube, capacity);
    });
  }

  function isTubeComplete(tube, capacity) {
    return tube.length === capacity && tube.every(function (color) {
      return color === tube[0];
    });
  }

  // Solver and hint engine
  function solveBoard(board, capacity, maxVisited) {
    var startBoard = encodeBoardForSolver(board);
    var startKey = serializeSolverBoard(startBoard);
    var costs = {};
    var parents = {};
    var heap = new MinHeap();
    var visited = 0;
    var current;
    var candidateMoves;
    var i;
    var nextBoard;
    var nextKey;
    var nextCost;

    costs[startKey] = 0;
    parents[startKey] = null;
    heap.push({
      key: startKey,
      board: startBoard,
      cost: 0,
      priority: solverHeuristic(startBoard, capacity),
      prevMove: null
    });

    while (heap.size() && visited < maxVisited) {
      current = heap.pop();
      visited += 1;

      if (current.cost !== costs[current.key]) {
        continue;
      }

      if (isSolvedSolverBoard(current.board, capacity)) {
        return reconstructSolverPath(parents, current.key);
      }

      candidateMoves = getSolverMoves(current.board, capacity, current.prevMove);
      for (i = 0; i < candidateMoves.length; i += 1) {
        nextBoard = applySolverMove(current.board, candidateMoves[i]);
        nextKey = serializeSolverBoard(nextBoard);
        nextCost = current.cost + 1;

        if (typeof costs[nextKey] !== "undefined" && costs[nextKey] <= nextCost) {
          continue;
        }

        costs[nextKey] = nextCost;
        parents[nextKey] = {
          parentKey: current.key,
          move: {
            source: candidateMoves[i].source,
            target: candidateMoves[i].target
          }
        };

        heap.push({
          key: nextKey,
          board: nextBoard,
          cost: nextCost,
          priority: nextCost + solverHeuristic(nextBoard, capacity),
          prevMove: {
            source: candidateMoves[i].source,
            target: candidateMoves[i].target
          }
        });
      }
    }

    return null;
  }

  function encodeBoardForSolver(board) {
    return board.map(function (tube) {
      return tube.map(function (colorKey) {
        return solverColorMap[colorKey];
      });
    });
  }

  function serializeSolverBoard(board) {
    return board.map(function (tube) {
      return tube.join("");
    }).join("|");
  }

  function isSolvedSolverBoard(board, capacity) {
    return board.every(function (tube) {
      return !tube.length || (tube.length === capacity && tube.every(function (value) {
        return value === tube[0];
      }));
    });
  }

  function getSolverMoves(board, capacity, prevMove) {
    var moves = [];
    var sourceIndex;
    var targetIndex;
    var sourceTube;
    var targetTube;
    var block;
    var sourceUniform;
    var score;

    for (sourceIndex = 0; sourceIndex < board.length; sourceIndex += 1) {
      sourceTube = board[sourceIndex];
      if (!sourceTube.length) {
        continue;
      }

      block = getTopBlock(sourceTube);
      sourceUniform = tubeIsUniform(sourceTube);

      if (sourceTube.length === capacity && sourceUniform) {
        continue;
      }

      for (targetIndex = 0; targetIndex < board.length; targetIndex += 1) {
        targetTube = board[targetIndex];
        score = 0;

        if (sourceIndex === targetIndex || targetTube.length === capacity) {
          continue;
        }
        if (targetTube.length && targetTube[targetTube.length - 1] !== block.color) {
          continue;
        }
        if ((capacity - targetTube.length) < block.count) {
          continue;
        }
        if (!targetTube.length && sourceUniform) {
          continue;
        }
        if (prevMove && prevMove.source === targetIndex && prevMove.target === sourceIndex) {
          continue;
        }

        if (targetTube.length) {
          score += 8;
        }
        if (targetTube.length + block.count === capacity) {
          score += 4;
        }
        if (sourceUniform) {
          score += 1;
        }
        score += block.count;

        moves.push({
          source: sourceIndex,
          target: targetIndex,
          count: block.count,
          color: block.color,
          score: score
        });
      }
    }

    moves.sort(function (a, b) {
      return b.score - a.score;
    });
    return moves;
  }

  function applySolverMove(board, move) {
    var nextBoard = board.map(function (tube) {
      return tube.slice();
    });
    var i;
    for (i = 0; i < move.count; i += 1) {
      nextBoard[move.target].push(nextBoard[move.source].pop());
    }
    return nextBoard;
  }

  function solverHeuristic(board) {
    var segments = 0;
    var uniformUnits = 0;

    board.forEach(function (tube) {
      var i;

      if (!tube.length) {
        return;
      }

      segments += 1;
      for (i = 1; i < tube.length; i += 1) {
        if (tube[i] !== tube[i - 1]) {
          segments += 1;
        }
      }

      if (tubeIsUniform(tube)) {
        uniformUnits += tube.length;
      }
    });

    return segments * 2 - uniformUnits * 0.4;
  }

  function reconstructSolverPath(parents, endKey) {
    var path = [];
    var currentKey = endKey;
    while (parents[currentKey]) {
      path.push(parents[currentKey].move);
      currentKey = parents[currentKey].parentKey;
    }
    return path.reverse();
  }

  function tubeIsUniform(tube) {
    var i;
    if (!tube.length) {
      return false;
    }
    for (i = 1; i < tube.length; i += 1) {
      if (tube[i] !== tube[0]) {
        return false;
      }
    }
    return true;
  }

  function MinHeap() {
    this.items = [];
  }

  MinHeap.prototype.size = function () {
    return this.items.length;
  };

  MinHeap.prototype.push = function (value) {
    this.items.push(value);
    this.bubbleUp(this.items.length - 1);
  };

  MinHeap.prototype.pop = function () {
    var first;
    var last;

    if (!this.items.length) {
      return null;
    }

    first = this.items[0];
    last = this.items.pop();

    if (this.items.length) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return first;
  };

  MinHeap.prototype.bubbleUp = function (index) {
    var parentIndex;
    while (index > 0) {
      parentIndex = Math.floor((index - 1) / 2);
      if (this.items[parentIndex].priority <= this.items[index].priority) {
        break;
      }
      swap(this.items, parentIndex, index);
      index = parentIndex;
    }
  };

  MinHeap.prototype.bubbleDown = function (index) {
    var length = this.items.length;
    var left;
    var right;
    var smallest;

    while (true) {
      left = index * 2 + 1;
      right = index * 2 + 2;
      smallest = index;

      if (left < length && this.items[left].priority < this.items[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.items[right].priority < this.items[smallest].priority) {
        smallest = right;
      }
      if (smallest === index) {
        break;
      }
      swap(this.items, smallest, index);
      index = smallest;
    }
  };

  // Lightweight procedural audio so the game works without external files.
  function createAudioEngine() {
    var context = null;
    var master = null;
    var bgmGain = null;
    var sfxGain = null;
    var schedulerId = 0;
    var nextBarTime = 0;
    var hasContext = false;

    function ensureContext() {
      var ContextClass;
      if (hasContext) {
        return;
      }
      ContextClass = window.AudioContext || window.webkitAudioContext;
      if (!ContextClass) {
        return;
      }
      context = new ContextClass();
      master = context.createGain();
      bgmGain = context.createGain();
      sfxGain = context.createGain();

      master.gain.value = 0.85;
      bgmGain.gain.value = 0.0001;
      sfxGain.gain.value = 0.24;

      bgmGain.connect(master);
      sfxGain.connect(master);
      master.connect(context.destination);
      hasContext = true;
    }

    function unlock() {
      ensureContext();
      if (!context) {
        return;
      }
      context.resume();
    }

    function sync() {
      if (!context) {
        return;
      }
      sfxGain.gain.setValueAtTime(state.settings.sfx ? 0.22 : 0.0001, context.currentTime);
      bgmGain.gain.setValueAtTime(state.settings.bgm && !document.hidden ? 0.12 : 0.0001, context.currentTime);
      if (state.settings.bgm && !document.hidden) {
        startBgm();
      } else {
        stopBgm();
      }
    }

    function startBgm() {
      if (!context || schedulerId || !state.settings.bgm) {
        return;
      }
      nextBarTime = context.currentTime + 0.04;
      schedulerId = window.setInterval(scheduleLoop, 500);
      scheduleLoop();
    }

    function stopBgm() {
      if (schedulerId) {
        clearInterval(schedulerId);
        schedulerId = 0;
      }
      nextBarTime = 0;
    }

    function scheduleLoop() {
      if (!context || !state.settings.bgm) {
        return;
      }
      while (nextBarTime < context.currentTime + 1.4) {
        scheduleBar(nextBarTime);
        nextBarTime += 3.2;
      }
    }

    function scheduleBar(startTime) {
      var melody = [
        { note: 392.0, time: 0.00, length: 0.22 },
        { note: 523.25, time: 0.34, length: 0.22 },
        { note: 659.25, time: 0.68, length: 0.24 },
        { note: 587.33, time: 1.06, length: 0.22 },
        { note: 523.25, time: 1.42, length: 0.24 },
        { note: 392.0, time: 1.82, length: 0.28 }
      ];
      var pad = [196.0, 246.94, 293.66];
      var i;

      for (i = 0; i < pad.length; i += 1) {
        scheduleTone(bgmGain, pad[i], startTime, 2.4, "triangle", 0.018);
      }
      for (i = 0; i < melody.length; i += 1) {
        scheduleTone(bgmGain, melody[i].note, startTime + melody[i].time, melody[i].length, "sine", 0.024);
      }
    }

    function playSfx(type) {
      if (!context || !state.settings.sfx) {
        return;
      }

      if (type === "move") {
        scheduleTone(sfxGain, 659.25, context.currentTime, 0.08, "triangle", 0.12);
        scheduleTone(sfxGain, 830.61, context.currentTime + 0.07, 0.1, "sine", 0.09);
        return;
      }

      if (type === "invalid") {
        scheduleTone(sfxGain, 360, context.currentTime, 0.08, "sawtooth", 0.08);
        scheduleTone(sfxGain, 220, context.currentTime + 0.06, 0.12, "triangle", 0.08);
        return;
      }

      if (type === "hint") {
        scheduleTone(sfxGain, 740, context.currentTime, 0.07, "triangle", 0.08);
        scheduleTone(sfxGain, 987.77, context.currentTime + 0.08, 0.1, "triangle", 0.08);
        return;
      }

      if (type === "clear") {
        scheduleTone(sfxGain, 523.25, context.currentTime, 0.14, "triangle", 0.1);
        scheduleTone(sfxGain, 659.25, context.currentTime + 0.12, 0.16, "triangle", 0.1);
        scheduleTone(sfxGain, 783.99, context.currentTime + 0.24, 0.18, "triangle", 0.1);
        scheduleTone(sfxGain, 1046.5, context.currentTime + 0.38, 0.28, "sine", 0.12);
      }
    }

    function scheduleTone(target, frequency, startTime, duration, type, volume) {
      var oscillator;
      var gain;

      if (!context || !target) {
        return;
      }

      oscillator = context.createOscillator();
      gain = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      oscillator.connect(gain);
      gain.connect(target);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.04);
    }

    return {
      unlock: unlock,
      sync: sync,
      playSfx: playSfx
    };
  }

  // Canvas confetti effect for premium clear feedback.
  function createCelebrationController() {
    var canvas = els.celebrationCanvas;
    var overlay = els.celebrationOverlay;
    var ctx = canvas.getContext("2d");
    var particles = [];
    var rafId = 0;
    var endTime = 0;
    var palette = ["#7A56FF", "#42D9B0", "#FFD96A", "#FF7AA6", "#63C5FF"];

    function resizeCanvas() {
      var ratio = window.devicePixelRatio || 1;
      var width = Math.max(window.innerWidth, 320);
      var height = Math.max(window.innerHeight, 480);

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function start() {
      var count = state.settings.motion === "vivid" ? 90 : state.settings.motion === "calm" ? 52 : 72;
      var i;

      stop();
      resizeCanvas();
      overlay.hidden = false;
      particles = [];

      for (i = 0; i < count; i += 1) {
        particles.push(createParticle(i));
      }

      endTime = Date.now() + 1900;
      rafId = requestAnimationFrame(step);
    }

    function stop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      particles = [];
      overlay.hidden = true;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function createParticle(index) {
      var width = window.innerWidth;
      var height = window.innerHeight;
      return {
        x: width * (0.1 + Math.random() * 0.8),
        y: height * (0.08 + Math.random() * 0.22),
        vx: -2.2 + Math.random() * 4.4,
        vy: 1.4 + Math.random() * 3.6,
        size: 5 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        spin: -0.2 + Math.random() * 0.4,
        gravity: 0.08 + Math.random() * 0.06,
        color: palette[index % palette.length],
        shape: Math.random() > 0.5 ? "rect" : "circle"
      };
    }

    function step() {
      var width = window.innerWidth;
      var height = window.innerHeight;
      var i;
      var particle;

      ctx.clearRect(0, 0, width, height);

      for (i = 0; i < particles.length; i += 1) {
        particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += particle.gravity;
        particle.rotation += particle.spin;

        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.fillStyle = particle.color;

        if (particle.shape === "rect") {
          ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.62);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, particle.size * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (Date.now() < endTime) {
        rafId = requestAnimationFrame(step);
      } else {
        stop();
      }
    }

    window.addEventListener("resize", resizeCanvas);

    return {
      start: start,
      stop: stop
    };
  }

  // Utility helpers
  function vibratePattern(type) {
    if (!state.settings.haptics || !navigator.vibrate) {
      return;
    }

    if (type === "select") {
      navigator.vibrate(10);
      return;
    }
    if (type === "success") {
      navigator.vibrate(16);
      return;
    }
    if (type === "invalid") {
      navigator.vibrate([26, 24, 26]);
      return;
    }
    if (type === "hint") {
      navigator.vibrate([18, 30, 18]);
      return;
    }
    if (type === "clear") {
      navigator.vibrate([18, 30, 18, 30, 40]);
    }
  }

  function cloneBoard(board) {
    return board.map(function (tube) {
      return tube.slice();
    });
  }

  function cloneObject(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getColorHex(colorKey) {
    return APP_DATA.palette[colorKey] ? APP_DATA.palette[colorKey].hex : "#9AA4CF";
  }

  function adjustHexColor(hex, amount) {
    var normalized = hex.replace("#", "");
    var r = clamp(parseInt(normalized.slice(0, 2), 16) + amount, 0, 255);
    var g = clamp(parseInt(normalized.slice(2, 4), 16) + amount, 0, 255);
    var b = clamp(parseInt(normalized.slice(4, 6), 16) + amount, 0, 255);
    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  function toRgba(hex, alpha) {
    var normalized = hex.replace("#", "");
    var r = parseInt(normalized.slice(0, 2), 16);
    var g = parseInt(normalized.slice(2, 4), 16);
    var b = parseInt(normalized.slice(4, 6), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  }

  function toHex(value) {
    var text = value.toString(16);
    return text.length === 1 ? "0" + text : text;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function swap(array, left, right) {
    var temp = array[left];
    array[left] = array[right];
    array[right] = temp;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTime(ms) {
    var totalSeconds = Math.floor((ms || 0) / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return padNumber(minutes) + ":" + padNumber(seconds);
  }

  function padNumber(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function getMotionScale() {
    return MOTION_SCALE_MAP[state.settings.motion] || 1;
  }
}());

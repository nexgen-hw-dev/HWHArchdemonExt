// ==UserScript==
// @name             HWHArchdemonExt
// @name:en          HWHArchdemonExt
// @name:ru          HWHArchdemonExt
// @namespace        HWHArchdemonExt
// @version          0.36-alpha
// @description      Archdemon add-on for HeroWarsHelper: runs the free Abyss chapter until the setup is collected and stops before the Archdemon
// @description:en   Archdemon add-on for HeroWarsHelper: runs the free Abyss chapter until the setup is collected and stops before the Archdemon
// @description:ru   Дополнение к HeroWarsHelper: крутит бесплатную главу Бездны, пока не соберётся связка, и останавливается перед Архидемоном
// @author           NexGen
// @license          Copyright NexGen
// @match            https://www.hero-wars.com/*
// @match            https://www.hero-wars.cn/*
// @match            https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at           document-start
// ==/UserScript==

(() => {
  // src/hwh.js
  var funcs = typeof HWHFuncs !== "undefined" ? HWHFuncs : {};
  var data = typeof HWHData !== "undefined" ? HWHData : {};
  var classes = typeof HWHClasses !== "undefined" ? HWHClasses : {};
  var hwhFound = typeof HWHClasses !== "undefined" && typeof HWHFuncs !== "undefined" && typeof HWHData !== "undefined";
  var { popup, confShow, setProgress, I18N, countdownTimer, getSaveVal, setSaveVal, addExtentionName, setIsCancalBattle } = funcs;
  var { i18nLangData, othersPopupButtons } = data;
  var { WinFixBattle } = classes;
  var helperVersion = typeof scriptInfo !== "undefined" ? String(scriptInfo?.version ?? "?") : "?";
  function missingHelperApi() {
    const has = {
      popup: typeof popup?.confirm === "function",
      confShow: typeof confShow === "function",
      setProgress: typeof setProgress === "function",
      I18N: typeof I18N === "function",
      countdownTimer: typeof countdownTimer === "function",
      getSaveVal: typeof getSaveVal === "function",
      setSaveVal: typeof setSaveVal === "function",
      addExtentionName: typeof addExtentionName === "function",
      setIsCancalBattle: typeof setIsCancalBattle === "function",
      i18nLangData: Boolean(i18nLangData?.en && i18nLangData?.ru),
      othersPopupButtons: Array.isArray(othersPopupButtons),
      WinFixBattle: typeof WinFixBattle === "function",
      "Caller.result": typeof Caller === "function" && typeof Caller.send === "function" && typeof Caller.prototype?.send === "function" && typeof Caller.prototype?.result === "function" && typeof Caller.prototype?.sideResult === "function",
      Calc: typeof Calc === "function",
      lib: typeof lib !== "undefined" && Boolean(lib?.data),
      "cheats.refreshGame": typeof cheats !== "undefined" && typeof cheats?.refreshGame === "function" && typeof cheats?.translate === "function"
    };
    return Object.keys(has).filter((name2) => !has[name2]);
  }
  function syncGame() {
    Promise.resolve().then(() => cheats.refreshGame()).catch((e) => console.error(e));
  }

  // src/state.js
  var sessionState = {
    /** Номер события. Определяется при каждом входе в меню */
    eventId: 0,
    /** Остановка по клику доступна на любом этапе, флаг общий на весь цикл */
    stopped: false,
    /** Монеты на старте захода, от них считается бухгалтерия */
    startCoins: 0,
    /**
     * С какого таймера начинать поиск проигрыша для слива, по составу: «44» → 10.5. Живёт только в пределах
     * прогона — от «Старт» до успеха или остановки: игрок может поднять усиление, и старое станет неверным
     */
    lossStart: {}
  };

  // src/abyss.js
  function toRoman(number) {
    const signs = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let text2 = "";
    let rest = Number(number) || 0;
    for (const [value, sign] of signs) {
      while (rest >= value) {
        text2 += sign;
        rest -= value;
      }
    }
    return text2;
  }
  function getTalismanRollBosses(chapterId) {
    const rollBosses = lib.data.invasion.chapter[chapterId]?.settings?.talismanRollBosses;
    return Array.isArray(rollBosses) && rollBosses.length ? rollBosses : [0];
  }
  function getAbyssSealId() {
    return Object.values(lib.data.invasion.list).find((e) => e.id == sessionState.eventId)?.settings?.abyssSealCoinId ?? 0;
  }
  function getAbyssChapters() {
    return Object.values(lib.data.invasion.chapter).filter((e) => e.invasionId === sessionState.eventId && e.isArchdemon);
  }
  function getAbyssRelicName() {
    const relicId = Object.values(lib.data.invasion.list).find((e) => e.id == sessionState.eventId)?.settings?.relicId;
    try {
      const relic = lib.data.workshop?.relic?.[relicId];
      return relic?.nameLocale ? cheats.translate(relic.nameLocale) : "";
    } catch (e) {
      return "";
    }
  }
  function getChapterSealCost(chapterId) {
    const sealId = getAbyssSealId();
    return Number(lib.data.invasion.chapter[chapterId]?.startCost?.coin?.[sealId] ?? 0);
  }
  function chapterTitle(chapter, number) {
    const numeral = `<span style="font-family: 'Times New Roman';">${toRoman(number)}</span>`;
    const key = chapter.clientData?.titleLocale;
    let name2 = "";
    try {
      name2 = key ? cheats.translate(key) : "";
    } catch (e) {
      name2 = "";
    }
    return name2 && name2 !== key ? `${numeral}&nbsp;${name2}` : `${I18N("NX_CHAPTER")}&nbsp;${numeral}`;
  }

  // src/constants.js
  var NX_SALE_TALISMAN_ID = 8009;
  var NX_PET_ID_THRESHOLD = 4400;
  var NX_TIMER_SEARCH_MAX_TRIES = 1e3;
  var NX_TIMER_SEARCH_GRID = 30;
  var NX_TIMER_SEARCH_BUDGET_MS = 6e4;
  var NX_LOSS_TIMER_RANGE = { min: 1.3, max: 25 };
  var NX_LOSS_TIMER_STEP = 0.5;
  var NX_LOSS_SEARCH_BUDGET_MS = 2e4;
  var NX_LOSS_SEARCH_MAX_TRIES = 200;
  var NX_LOSS_MEMORY_BACKOFF = 5;
  var NX_PACE = {
    afterBattle: [670, 870],
    talismanPick: [600, 870],
    stallOpen: [35, 70],
    stallAll: [70, 170],
    firstAction: [330, 600],
    betweenActions: [230, 600],
    beforeBattle: [530, 1e3],
    chapterEnter: [400, 530],
    autoBattle: [1200, 2e3]
  };
  var NX_SAVE_KEYS = {
    chapter: "savedChapterForArchdemonNew",
    team: "savedTeamForArchdemonNew",
    mainPet: "savedMainPetForArchdemonNew",
    talisman: "savedTalismanForArchdemonNew",
    talismans: "savedTalismanIdsForArchdemonNew",
    minCoins: "savedMinCoinsForArchdemonNew",
    carry: "savedCarryHeroesForArchdemonNew",
    sacrifice: "savedSacrificeHeroesForArchdemonNew",
    pause: "savedPauseAfterBossForArchdemonNew",
    carryExtra: "savedCarryExtraHeroesForArchdemonNew",
    startRefreshes: "savedStartRefreshesForArchdemonNew",
    sacrificeRefreshes: "savedSacrificeRefreshesForArchdemonNew",
    randomAny: "savedBuyAnyRandomLotsForArchdemonNew"
  };
  var NX_WEALTH_TALISMAN_ID = 8008;
  var NX_EXCLUDED_TALISMAN_IDS = [8005, 8009];
  var NX_TEAM_SIZE = 5;
  var NX_MIN_LOT_COST = 12;
  var NX_STALL_REFRESH_COST = 3;
  var NX_RUN_PAUSE_MIN_SECONDS = 1;
  var NX_RUN_PAUSE_MAX_SECONDS = 2;
  var NX_FRAGMENT_SELL_PRICE = 8;
  var NX_MIN_COINS_SLACK = 30;
  var NX_SACRIFICE_LOSSES = 2;
  var NX_SACRIFICE_MAX_REFRESHES = 30;
  var NX_LOTS_PER_EARNED_REFRESH = 2;
  var NX_POINT1_MAX_REFRESHES = 30;
  var NX_RANDOM_LOT_FRAGMENTS = 2;
  var NX_BATTLE_TIMER_RANGE = { min: 1.3, max: 25 };
  var NX_LOG_CASH = `КАССА[${GM_info.script.version}]`;
  var NX_LOG_BATTLE = `БОЙ[${GM_info.script.version}]`;

  // src/runLog.js
  var NX_RUN_LOG_ID = "nxRunLog";
  var box = null;
  var live = null;
  var PANEL_STYLE = [
    "position: fixed",
    /** Отступ от правого края такой, чтобы не закрывать крестики окон игры */
    "right: 110px",
    "top: 60px",
    "width: 360px",
    "max-height: 60vh",
    "display: flex",
    "flex-direction: column",
    "box-sizing: border-box",
    "padding: 8px 10px",
    "background: #190e08e6",
    "border: 2px solid #ce9767",
    "border-radius: 8px",
    "color: #fce1ac",
    "font: 600 13px sans-serif",
    "letter-spacing: 0.5px",
    /** Ниже окон помощника: итоговые окна ложатся поверх журнала */
    "z-index: 10000"
  ].join("; ");
  var STOP_STYLE = [
    "background: #3a1f10",
    "color: #fce1ac",
    "border: 1px solid #ce9767",
    "border-radius: 5px",
    "padding: 2px 12px",
    "font: inherit",
    "cursor: pointer"
  ].join("; ");
  function runLogOpen(onStop) {
    document.getElementById(NX_RUN_LOG_ID)?.remove();
    const root = document.createElement("div");
    root.id = NX_RUN_LOG_ID;
    root.setAttribute("style", PANEL_STYLE);
    root.innerHTML = `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><div data-part="title" style="flex: 1; font-size: 15px; color: #ffd88a;"></div><button data-part="stop" type="button" style="${STOP_STYLE}"></button></div><div data-part="last" style="display: none; font-size: 12px; color: #e0a0a0; margin-bottom: 6px;"></div><div data-part="list" style="flex: 1; overflow-y: auto; min-height: 40px;"></div><div data-part="footer" style="display: none; margin-top: 6px; padding-top: 6px; border-top: 1px solid #ce976766;"></div>`;
    document.body.append(root);
    const part = (name2) => root.querySelector(`[data-part="${name2}"]`);
    box = { root, title: part("title"), last: part("last"), list: part("list"), footer: part("footer"), stop: part("stop") };
    live = null;
    box.stop.textContent = I18N("NX_LOG_STOP");
    box.stop.addEventListener("click", () => {
      box.stop.textContent = I18N("NX_LOG_STOPPING");
      box.stop.disabled = true;
      onStop();
    });
  }
  function runLogIsOpen() {
    return box !== null;
  }
  function runLogStartAttempt(attempt, lastFailure) {
    if (!box) return;
    box.title.innerHTML = I18N("NX_ATTEMPT", { attempt });
    box.list.innerHTML = "";
    box.footer.innerHTML = "";
    box.footer.style.display = "none";
    live = null;
    if (lastFailure) {
      box.last.innerHTML = I18N("NX_LOG_LAST_FAIL", lastFailure);
      box.last.style.display = "";
    } else {
      box.last.style.display = "none";
    }
  }
  function addLine(html) {
    const line = document.createElement("div");
    line.style.margin = "2px 0";
    line.innerHTML = html;
    box.list.append(line);
    box.list.scrollTop = box.list.scrollHeight;
    return line;
  }
  function runLogLine(html, liveKey = null) {
    if (!box) return;
    if (liveKey) {
      if (live && live.key === liveKey && live.element.isConnected) {
        live.element.innerHTML = html;
        return;
      }
      live = { key: liveKey, element: addLine(html) };
      return;
    }
    live = null;
    addLine(html);
  }
  function runLogFail(html) {
    if (!box) return;
    live = null;
    box.footer.innerHTML = `<div style="color: #ff6b6b;">${html}</div><div data-part="timer" style="margin-top: 4px;"></div>`;
    box.footer.style.display = "";
  }
  async function runLogCountdown(seconds) {
    const finish = Date.now() + seconds * 1e3;
    const timer = box?.footer.querySelector('[data-part="timer"]') ?? null;
    while (Date.now() < finish) {
      if (sessionState.stopped) return false;
      if (timer) {
        timer.textContent = I18N("NX_COOLDOWN", { seconds: ((finish - Date.now()) / 1e3).toFixed(1) });
      }
      await new Promise((e) => setTimeout(e, 100));
    }
    if (timer) timer.textContent = "";
    return !sessionState.stopped;
  }
  function runLogClose() {
    box?.root.remove();
    box = null;
    live = null;
  }

  // src/progress.js
  function archdemonNewStop() {
    sessionState.stopped = true;
    console.log("%cArchRank: запрошена остановка", "color: red; font-weight: bold;");
  }
  function archdemonNewProgress(text2, liveKey = null) {
    if (runLogIsOpen()) {
      runLogLine(text2, liveKey);
      return;
    }
    setProgress(text2, false, archdemonNewStop);
  }
  function archdemonNewStoppedResult() {
    return { ok: false, reason: I18N("NX_REASON_STOPPED") };
  }

  // src/units.js
  var live2 = null;
  function setOwnedFragments(fragments) {
    const next = {};
    for (const [id, amount] of Object.entries(fragments ?? {})) {
      if (Number(amount) !== 0) next[id] = amount;
    }
    if (!live2) {
      live2 = next;
      return;
    }
    for (const key of Object.keys(live2)) delete live2[key];
    Object.assign(live2, next);
  }
  function clearOwnedFragments() {
    live2 = null;
  }
  async function readOwnedUnits() {
    if (!live2) {
      const info = await Caller.send("invasion_getInfo");
      setOwnedFragments(info?.fragments);
    }
    const byAmount = Object.keys(live2).map(Number).filter((id) => Number(live2[id]) > 0).sort((a, b) => Number(live2[b]) - Number(live2[a]));
    const heroIds = byAmount.filter((id) => id < NX_PET_ID_THRESHOLD);
    return {
      fragments: live2,
      heroIds,
      bestFive: heroIds.slice(0, NX_TEAM_SIZE),
      pets: byAmount.filter((id) => id > NX_PET_ID_THRESHOLD)
    };
  }

  // src/wallet.js
  var wallet = { value: 0 };
  var STALL_COIN = 1080;
  function coinsOf(reward) {
    return Number(reward?.coin?.[STALL_COIN] ?? 0);
  }
  function walletAddReward(reward) {
    const amount = coinsOf(reward);
    wallet.value += amount;
    return amount;
  }
  async function walletLoad() {
    wallet.value = await Caller.send("inventoryGet").then((e) => Number(e.coin[STALL_COIN] ?? 0));
    return wallet.value;
  }
  async function walletOnChapterEntry(chapterInfo, afterReset) {
    const start = chapterInfo?.reward?.coin?.[STALL_COIN];
    if (afterReset && start !== void 0) {
      wallet.value = Number(start);
      return wallet.value;
    }
    return await walletLoad();
  }

  // src/battle.js
  var PointTimerSearch = class extends (WinFixBattle ?? class {
  }) {
    constructor(battle, range) {
      super(battle);
      this.isGetTimer = false;
      this.minTimer = range.min;
      this.maxTimer = range.max;
      this.pending = [];
      this.depth = 0;
    }
    /**
     * Следующий слой таймеров: на первом все узлы сетки, дальше только новые середины.
     * К каждому узлу малый случайный сдвиг в пределах четверти шага: покрытие сетки то же,
     * а одни и те же точные числа не повторяются из боя в бой
     */
    addLayer() {
      const parts = NX_TIMER_SEARCH_GRID * 2 ** this.depth;
      const step = (this.maxTimer - this.minTimer) / parts;
      const first = this.depth === 0;
      for (let i = first ? 0 : 1; i <= parts; i += first ? 1 : 2) {
        const timer = this.minTimer + i * step + (Math.random() - 0.5) * step * 0.5;
        this.pending.push(Math.min(this.maxTimer, Math.max(this.minTimer, timer)));
      }
      this.depth++;
    }
    randTimer() {
      if (this.pending.length === 0) {
        this.addLayer();
      }
      return this.pending.shift();
    }
    /** Ход подбора — одной строкой нашего журнала, а не в мигающую строку помощника */
    showResult() {
      archdemonNewProgress(I18N("NX_TIMER_SEARCH", { count: this.count, max: this.maxCount }), "timer");
    }
  };
  function lossTimerQueue(start, range = NX_LOSS_TIMER_RANGE, step = NX_LOSS_TIMER_STEP) {
    const from = Math.min(range.max, Math.max(range.min, Number(start) || range.min));
    const jitter = (t, i) => i === 0 ? t : Math.min(range.max, Math.max(range.min, t + (Math.random() - 0.5) * step * 0.5));
    const up = [];
    for (let t = from; t <= range.max + 1e-9; t += step) up.push(t);
    const down = [];
    for (let t = range.min; t < from - 1e-9; t += step) down.push(t);
    return [...up, ...down].map(jitter);
  }
  function nextLossStart(found, range = NX_LOSS_TIMER_RANGE) {
    return Math.max(range.min, Number(found) - NX_LOSS_MEMORY_BACKOFF);
  }
  var LossTimerSearch = class extends (WinFixBattle ?? class {
  }) {
    constructor(battle, start, range = NX_LOSS_TIMER_RANGE) {
      super(battle);
      this.isGetTimer = false;
      this.minTimer = range.min;
      this.maxTimer = range.max;
      this.pending = lossTimerQueue(start, range);
    }
    randTimer() {
      if (this.pending.length === 0) this.exhausted = true;
      return this.pending.length ? this.pending.shift() : this.maxTimer;
    }
    checkResult() {
      if (this.count > 1 && this.lastBattleResult && !this.lastBattleResult.win) {
        this.bestResult = {
          count: this.count,
          timer: this.lastTimer,
          value: 0,
          result: structuredClone(this.lastBattleResult),
          progress: structuredClone(this.lastBattleProgress),
          battleTimer: this.lastResult.battleTimer,
          battleTime: this.lastResult.battleTime
        };
      }
    }
    isEndLoop() {
      const found = Boolean(this.bestResult?.result) && this.bestResult.result.win === false;
      return found || this.exhausted || this.count >= this.maxCount || this.endTime < Date.now();
    }
    showResult() {
      archdemonNewProgress(I18N("NX_LOSS_SEARCH", { count: this.count, max: this.maxCount }), "timer");
    }
  };
  function lossSkipWait(timer, battleTimer, battleTime) {
    const full = Number(battleTimer);
    const length = Number(battleTime);
    let k = 1 / 1.5;
    if (Number.isFinite(full) && full > 1.5 && Number.isFinite(length) && length > 0) k = (full - 1.5) / length;
    k = Math.min(1 / 1.5, Math.max(0.2, k));
    const [min, max] = NX_PACE.autoBattle;
    const wait = Number(timer) * k + 1.5 + (min + Math.random() * (max - min)) / 1e3;
    return Number.isFinite(full) && full > 0 ? Math.min(full, wait) : wait;
  }
  async function waitWithCountdown(startedAt, seconds, onTick) {
    let left = startedAt + Number(seconds) * 1e3 - Date.now();
    while (left > 0) {
      onTick(Math.ceil(left / 1e3));
      const step = Math.min(1e3, left);
      await new Promise((e) => setTimeout(e, step));
      left -= step;
    }
  }
  function defendersSnapshot(battle) {
    const team = battle?.defenders?.[0];
    const units = Array.isArray(team) ? team : Object.values(team ?? {});
    return {
      units: units.map((u) => ({ id: u?.id, hp: u?.hp, state: u?.state })),
      effects: battle?.effects?.defenders ?? null
    };
  }
  async function waitBattleTime(startedAt, improvedTimer = 0) {
    const seconds = Number(improvedTimer);
    let until;
    if (Number.isFinite(seconds) && seconds > 0) {
      until = startedAt + seconds * 1e3;
    } else {
      const [min, max] = NX_PACE.autoBattle;
      until = startedAt + min + Math.random() * (max - min);
    }
    const left = until - Date.now();
    if (left > 0) await new Promise((e) => setTimeout(e, left));
  }
  async function sendBattleEnd(missionId, outcome) {
    const call = new Caller([
      { name: "invasion_bossEnd", args: { id: missionId, result: outcome.result, progress: outcome.progress } },
      { name: "invasion_getInfo", args: {} }
    ]);
    setIsCancalBattle(false);
    try {
      await call.send();
    } finally {
      setIsCancalBattle(true);
    }
    const end = call.result("invasion_bossEnd");
    const info = call.result("invasion_getInfo");
    const reward = walletAddReward(end?.reward);
    if (reward) console.log(`${NX_LOG_CASH} +${reward} награда за бой, монет ${wallet.value}`);
    const lives = walletAddReward(end?.exchangeLivesReward);
    if (lives) console.log(`${NX_LOG_CASH} +${lives} обмен жизней, монет ${wallet.value}`);
    if (info?.fragments) setOwnedFragments(info.fragments);
    const invalid = Boolean(end?.result?.afterInvalid || call.sideResult("invasion_bossEnd")?.afterInvalid);
    if (invalid) console.error("Сервер не принял результат боя: afterInvalid", end);
    return { info, invalid };
  }
  async function fightPoint(missionId, chapterId, heroes, pet, favor) {
    try {
      const battle = await Caller.send({
        name: "invasion_bossStart",
        args: { id: missionId, chapterId, heroes, pet, favor }
      });
      const startedAt = Date.now();
      let outcome = await Calc(battle);
      let improvedTimer = 0;
      if (!outcome.result.win) {
        const search = new PointTimerSearch(battle, NX_BATTLE_TIMER_RANGE);
        const found = await search.start(startedAt + NX_TIMER_SEARCH_BUDGET_MS, NX_TIMER_SEARCH_MAX_TRIES);
        if (found.result?.win) {
          outcome = { ...outcome, result: found.result, progress: found.progress };
          improvedTimer = found.battleTimer ?? outcome.battleTimer;
        }
      }
      await waitBattleTime(startedAt, improvedTimer);
      return { error: false, ...await sendBattleEnd(missionId, outcome) };
    } catch (e) {
      console.error(e);
      return { error: true };
    }
  }
  async function loseBattleOnPurpose(missionId, chapterId, heroes, lossStart = NX_LOSS_TIMER_RANGE.min) {
    try {
      const battle = await Caller.send({
        name: "invasion_bossStart",
        args: { id: missionId, chapterId, heroes, favor: {} }
      });
      const startedAt = Date.now();
      console.log(`Слив: противник на старте ${JSON.stringify(defendersSnapshot(battle))}`);
      let outcome = await Calc(battle);
      let improvedTimer = 0;
      let lossTimer = null;
      if (outcome.result?.win) {
        const searchStart = Date.now();
        const search = new LossTimerSearch(battle, lossStart);
        const found = await search.start(searchStart + NX_LOSS_SEARCH_BUDGET_MS, NX_LOSS_SEARCH_MAX_TRIES);
        const tries = found.maxCount ?? search.count ?? 0;
        if (found.result && found.result.win === false) {
          outcome = { ...outcome, result: found.result, progress: found.progress };
          lossTimer = found.timer;
          const fullWait = found.battleTimer ?? outcome.battleTimer;
          improvedTimer = lossSkipWait(lossTimer, fullWait, found.battleTime);
          console.log(
            `Слив: проигрыш найден на таймере ${Number(lossTimer).toFixed(2)} с, ждём ${improvedTimer.toFixed(1)} с как пропуск после «авто» (весь бой ${fullWait} с), перебор ${tries} расчётов за ${Date.now() - searchStart} мс, начало с ${Number(lossStart).toFixed(1)} с`
          );
        } else {
          console.log(`Слив: проигрыша не нашлось за ${tries} расчётов и ${Date.now() - searchStart} мс, уходит обычный автобой`);
          archdemonNewProgress(I18N("NX_LOSS_NOT_FOUND"), "timer");
        }
      }
      if (lossTimer != null) {
        await waitWithCountdown(startedAt, improvedTimer, (seconds) => archdemonNewProgress(I18N("NX_LOSS_FOUND_WAIT", { seconds }), "timer"));
      } else {
        await waitBattleTime(startedAt, improvedTimer);
      }
      const end = await sendBattleEnd(missionId, outcome);
      if (lossTimer != null) archdemonNewProgress(I18N("NX_LOSS_SENT"), "timer");
      console.log("Слив, расчёт вернул", JSON.stringify(outcome.result));
      return { calcSaysWin: outcome.result?.win === true, lossTimer, ...end };
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  // src/parse.js
  function getPetLib() {
    return lib.getData("pet") ?? lib.data.pet;
  }
  function getEventUnitPool() {
    try {
      return (lib.data.invasion.list[sessionState.eventId]?.attackUnitsPool?.availableUnits ?? []).map(Number);
    } catch (e) {
      console.error(e);
      return [];
    }
  }
  function getEventPetIds() {
    return getEventUnitPool().filter((e) => e > 4400);
  }
  function getEventHeroIds() {
    return getEventUnitPool().filter((e) => e < 1e3);
  }
  function unitName(id) {
    return `${cheats.translate(`LIB_HERO_NAME_${id}`)} (${id})`;
  }
  function escapeAttr(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function rankToFragments(rank) {
    if (rank >= 7) return 7;
    if (rank >= 3) return 3;
    if (rank >= 1) return 1;
    return 0;
  }
  function normalizePetId(raw) {
    const value = String(raw ?? "").trim();
    if (value === "" || value === "-") return 0;
    if (!/^\d+$/.test(value)) return -1;
    let id = Number(value);
    if (id < 100) {
      id = 6e3 + id;
    }
    return getPetLib()[id] ? id : -1;
  }
  function parseMinCoins(raw) {
    const value = String(raw ?? "").replace(/\s+/g, "");
    if (value === "") return { value: null };
    if (!/^\d+$/.test(value)) return null;
    return { value: Number(value) };
  }
  function coinsToPercent(coins) {
    let multiplier = 0.3;
    try {
      const talisman = Object.values(lib.data.invasion.talismans).find((e) => Number(e.id) === NX_WEALTH_TALISMAN_ID);
      multiplier = Number(talisman?.effectConfig?.attackBonusMultiplier ?? multiplier);
    } catch (e) {
      console.error(e);
    }
    return Math.floor(Number(coins) * multiplier);
  }
  function parseArchdemonNewTeam(raw) {
    const petLib = getPetLib();
    const eventHeroes = getEventHeroIds();
    const blocks = String(raw ?? "").split(",").map((e) => e.trim()).filter((e) => e !== "");
    if (blocks.length < 1 || blocks.length > NX_TEAM_SIZE) {
      return { error: I18N("NX_ERR_BLOCKS") };
    }
    const heroes = [];
    const targets = {};
    const favor = {};
    const favorPets = [];
    for (const block of blocks) {
      const parts = block.split("/").map((e) => e.trim());
      if (parts.length !== 3) {
        return { error: I18N("NX_ERR_BLOCK_FORMAT", { block }) };
      }
      const heroId = Number(parts[0]);
      if (!Number.isInteger(heroId) || heroId <= 0) {
        return { error: I18N("NX_ERR_BLOCK_FORMAT", { block }) };
      }
      if (heroes.includes(heroId)) {
        return { error: I18N("NX_ERR_HERO_DUP", { hero: unitName(heroId) }) };
      }
      if (eventHeroes.length > 0 && !eventHeroes.includes(heroId)) {
        return { error: I18N("NX_ERR_HERO", { hero: unitName(heroId) }) };
      }
      const rank = Number(parts[1]);
      if (!Number.isInteger(rank) || rank < 1 || rank > 7) {
        return { error: I18N("NX_ERR_RANK", { block }) };
      }
      const petId = normalizePetId(parts[2]);
      if (petId === -1) {
        return { error: I18N("NX_ERR_PET", { block }) };
      }
      if (petId > 0) {
        if (favorPets.includes(petId)) {
          return { error: I18N("NX_ERR_PET_DUP", { pet: unitName(petId) }) };
        }
        const favorHeroes = (petLib[petId]?.favorHeroes ?? []).map(Number);
        if (!favorHeroes.includes(heroId)) {
          return { error: I18N("NX_ERR_FAVOR", { pet: unitName(petId), hero: unitName(heroId) }) };
        }
        favorPets.push(petId);
        favor[heroId] = petId;
      }
      heroes.push(heroId);
      targets[heroId] = rankToFragments(rank);
    }
    return { heroes, targets, favor, favorPets };
  }
  function parseRankedIdList(raw) {
    const parts = String(raw ?? "").split(",").map((e) => e.trim()).filter((e) => e !== "");
    if (parts.length === 0) return null;
    const list = [];
    for (const part of parts) {
      const [idPart, rankPart] = part.split("/").map((e) => e.trim());
      const id = Number(idPart);
      const rank = rankPart === void 0 ? 1 : Number(rankPart);
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(rank) || rank < 1 || rank > 7) return null;
      if (!list.some((e) => e.id === id)) list.push({ id, rank: rankToFragments(rank) });
    }
    return list;
  }
  function parseIdList(raw) {
    const ids = String(raw ?? "").split(/[,\s]+/).map((e) => e.trim()).filter((e) => e !== "").map(Number);
    if (ids.length === 0) return null;
    if (ids.some((e) => !Number.isInteger(e) || e <= 0)) return null;
    return [...new Set(ids)];
  }

  // src/collect.js
  function carryPackReady(setup, fragments) {
    const mainReady = setup.carryHeroes.every((id) => Number(fragments[id] ?? 0) > 0);
    const extras = setup.carryExtraHeroes ?? [];
    return mainReady && (extras.length === 0 || carryExtraOwned(setup, fragments));
  }
  function carryExtraOwned(setup, fragments) {
    return (setup.carryExtraHeroes ?? []).some((id) => Number(fragments[id] ?? 0) > 0);
  }
  function carryNeedFor(setup, fragments, heroId) {
    const have = Number(fragments[heroId] ?? 0);
    if (setup.carryHeroes.includes(heroId)) {
      return Math.max(0, 1 - have);
    }
    const extras = setup.carryExtraHeroes ?? [];
    if (extras.length > 0 && extras.includes(heroId) && !carryExtraOwned(setup, fragments)) {
      return Math.max(0, 1 - have);
    }
    return 0;
  }
  function carryRankNeedFor(setup, fragments, heroId) {
    if (!setup.carryHeroes.includes(heroId)) return 0;
    return Math.max(0, Number(setup.carryTargets?.[heroId] ?? 1) - Number(fragments[heroId] ?? 0));
  }
  function sacrificeHeroOf(setup) {
    return Number((setup.sacrificeHeroes ?? [])[0] ?? 0);
  }
  function sacrificeNeedFor(setup, fragments, heroId) {
    const sacrifice = sacrificeHeroOf(setup);
    if (!sacrifice || heroId !== sacrifice || setup.carryHeroes.includes(heroId)) return 0;
    return Math.max(0, 1 - Number(fragments[heroId] ?? 0));
  }
  function collectedState(setup, fragments) {
    const heroesLeft = setup.heroes.filter((heroId) => Number(fragments[heroId] ?? 0) < setup.targets[heroId]);
    const petsLeft = setup.petsToCollect.filter((petId) => Number(fragments[petId] ?? 0) <= 0);
    return { heroesLeft, petsLeft, done: heroesLeft.length === 0 && petsLeft.length === 0 };
  }
  function fullPricePetsAllowed(setup, fragments) {
    let short = 0;
    for (const heroId of setup.heroes) {
      short += Math.max(0, Number(setup.targets[heroId] ?? 0) - Number(fragments[heroId] ?? 0));
    }
    const petsLeft = setup.petsToCollect.filter((petId) => Number(fragments[petId] ?? 0) <= 0).length;
    return short <= 1 && petsLeft <= 1;
  }
  async function checkArchdemonNewConditions(setup) {
    const fragments = (await readOwnedUnits()).fragments;
    const state = collectedState(setup, fragments);
    if (!state.done) {
      const list = [...state.heroesLeft, ...state.petsLeft].map(unitName).join(", ");
      return { ok: false, reason: I18N("NX_REASON_NOT_COLLECTED", { list }) };
    }
    const coins = wallet.value;
    const percent = coinsToPercent(coins);
    if (setup.talismanId === NX_WEALTH_TALISMAN_ID && setup.minCoins != null && coins < setup.minCoins) {
      return { ok: false, reason: I18N("NX_REASON_MIN_COINS", { coins, percent, min: setup.minCoins }) };
    }
    return { ok: true, coins, percent };
  }
  function applyReward(fragments, reward) {
    if (!reward) return;
    for (const key of ["invasionFragmentHero", "invasionFragmentPet"]) {
      for (const [id, amount] of Object.entries(reward[key] ?? {})) {
        fragments[Number(id)] = Number(fragments[Number(id)] ?? 0) + Number(amount);
      }
    }
  }
  function keepAmountFor(setup, fragmentId, keepCarry) {
    if (keepCarry) {
      if (setup.carryHeroes.includes(fragmentId)) return Infinity;
      if ((setup.carryExtraHeroes ?? []).includes(fragmentId)) return Infinity;
      if ((setup.sacrificeHeroes ?? []).includes(fragmentId)) return Infinity;
    }
    if (setup.targets[fragmentId]) return setup.targets[fragmentId];
    return 0;
  }

  // src/pace.js
  function pause(range) {
    const [min, max] = range;
    return new Promise((e) => setTimeout(e, min + Math.random() * (max - min)));
  }
  var actionsInVisit = 0;
  function newStallVisit() {
    actionsInVisit = 0;
  }
  function beforeStallAction() {
    return pause(actionsInVisit++ === 0 ? NX_PACE.firstAction : NX_PACE.betweenActions);
  }

  // src/ledger.js
  var archdemonNewLedger = {};
  function ledgerReset(startCoins) {
    sessionState.startCoins = Number(startCoins) || 0;
    for (const key of Object.keys(archdemonNewLedger)) {
      delete archdemonNewLedger[key];
    }
  }
  function ledgerAdd(category, delta) {
    const value = Number(delta) || 0;
    if (value === 0) return;
    archdemonNewLedger[category] = (archdemonNewLedger[category] ?? 0) + value;
  }
  function ledgerSummary(finalCoins) {
    const entries = Object.entries(archdemonNewLedger).sort((a, b) => a[1] - b[1]);
    const mine = entries.reduce((sum, e) => sum + e[1], 0);
    const fromPoints = Number(finalCoins) - sessionState.startCoins - mine;
    return { entries, mine, fromPoints, start: sessionState.startCoins, final: Number(finalCoins) };
  }

  // src/prices.js
  function fragmentSellPrice(kind) {
    const settings = lib.data.invasion.list[sessionState.eventId]?.settings;
    const price = Number(settings?.fragmentSellReward?.[kind]?.coin?.[1080] ?? 0);
    if (price > 0) return price;
    return kind === "hero" ? NX_FRAGMENT_SELL_PRICE : 0;
  }
  function randomLotResale() {
    return NX_RANDOM_LOT_FRAGMENTS * fragmentSellPrice("hero");
  }
  function petLotBaseCost(shopId) {
    let base = 0;
    for (const list of Object.values(lib.data.shop?.[shopId]?.slots ?? {})) {
      for (const lot of list) {
        if (!lot.reward?.invasionFragmentPet) continue;
        const cost = Number(lot.cost?.coin?.[1080] ?? 0);
        if (cost > 0 && (!base || cost < base)) base = cost;
      }
    }
    return base;
  }
  function isDiscountedPetSlot(slot, shopId) {
    if (!slot.reward?.invasionFragmentPet) return false;
    const cost = Number(slot.cost?.coin?.[1080] ?? 0);
    const base = petLotBaseCost(shopId);
    return cost > 0 && base > 0 && cost < base;
  }

  // src/talismans.js
  function offeredTalismans(answer) {
    const ids = Array.isArray(answer?.talismanIds) ? answer.talismanIds : Object.values(answer ?? {});
    return ids.map(Number).filter((id) => Number.isFinite(id) && id > 0 && id !== NX_SALE_TALISMAN_ID);
  }
  async function chooseTalisman(setup, offered, takenRolls) {
    const rollIndex = takenRolls.length;
    const wanted = Number(setup.talismanIds?.[rollIndex] ?? 0);
    const pick = wanted ? offered.find((id) => id === wanted) : offered[0];
    console.log(
      "Талисманы на выбор",
      JSON.stringify(offered),
      "выдача",
      rollIndex + 1,
      "нужен",
      wanted || "любой",
      "берём",
      pick ?? "ничего"
    );
    if (!pick) return I18N("NX_REASON_NO_TALISMAN");
    await Caller.send({ name: "invasion_selectTalisman", args: { talismanId: pick } });
    takenRolls.push(pick);
    archdemonNewProgress(I18N("NX_TALISMAN_TAKEN", { name: cheats.translate(`LIB_TALISMAN_NAME_${pick}`) }));
    return null;
  }

  // src/stall.js
  function stallShopId() {
    const bound = Object.values(lib.data.shop).filter((shop) => shop.requirements?.invasion?.id === sessionState.eventId);
    if (bound.length === 1) return bound[0].id;
    const heroChapter = Object.values(lib.data.invasion.chapter).find(
      (chapter) => chapter.invasionId === sessionState.eventId && chapter.settings?.unitType === "hero" && chapter.settings?.stallShopId
    );
    return heroChapter ? heroChapter.settings.stallShopId : false;
  }
  async function openStallVisit(shopId, onTalismans) {
    newStallVisit();
    if (sessionState.stopped) return { reason: I18N("NX_REASON_STOPPED") };
    const offered = offeredTalismans(await Caller.send("invasion_rollTalismans"));
    if (offered.length > 0) {
      await pause(NX_PACE.stallAll);
      await Caller.send("shopGetAll");
      await pause(NX_PACE.talismanPick);
      if (sessionState.stopped) return { reason: I18N("NX_REASON_STOPPED") };
      const reason = onTalismans ? await onTalismans(offered) : I18N("NX_REASON_NO_TALISMAN");
      if (reason) return { reason };
      await pause(NX_PACE.stallOpen);
      return { slots: await getStall(shopId) };
    }
    await pause(NX_PACE.stallOpen);
    const slots = await getStall(shopId);
    await pause(NX_PACE.stallAll);
    await Caller.send("shopGetAll");
    return { slots };
  }
  async function getStall(shopId) {
    const answer = await Caller.send({ name: "shopGet", args: { shopId } });
    const bonus = walletAddReward(answer?.bonusReward);
    if (bonus) console.log(`${NX_LOG_CASH} +${bonus} бонус за открытие лавки, монет ${wallet.value}`);
    return Object.values(answer?.slots ?? {});
  }
  async function refreshStall(shopId, coins) {
    try {
      await beforeStallAction();
      const answer = await Caller.send({ name: "shopRefresh", args: { shopId } });
      coins.value -= NX_STALL_REFRESH_COST;
      console.log(`${NX_LOG_CASH} обновили лавку, монет ${coins.value}`);
      return Object.values(answer.slots);
    } catch (e) {
      console.error(e);
      coins.value = await walletLoad();
      return null;
    }
  }

  // src/shop.js
  function slotValue(slot, setup, fragments, carryOnly, waitPetDiscount = false) {
    const heroReward = slot.reward?.invasionFragmentHero ?? {};
    const petReward = slot.reward?.invasionFragmentPet ?? {};
    const neededIds = [];
    let useful = 0;
    let resale = 0;
    for (const [id, amount] of Object.entries(heroReward)) {
      const heroId = Number(id);
      const have = Number(fragments[heroId] ?? 0);
      const count = Number(amount);
      if (keepAmountFor(setup, heroId, carryOnly !== false) === 0) resale += count * fragmentSellPrice("hero");
      let need = 0;
      if (carryOnly === "rank") {
        need = carryRankNeedFor(setup, fragments, heroId);
      } else if (carryOnly) {
        need = carryNeedFor(setup, fragments, heroId);
      } else {
        need = Math.max(0, Number(setup.targets[heroId] ?? 0) - have);
      }
      if (need > 0) neededIds.push(heroId);
      useful += Math.min(count, need);
    }
    if (!carryOnly) {
      for (const [id, amount] of Object.entries(petReward)) {
        const petId = Number(id);
        let need = setup.petsToCollect.includes(petId) && Number(fragments[petId] ?? 0) <= 0 ? 1 : 0;
        if (need > 0 && waitPetDiscount && !isDiscountedPetSlot(slot, stallShopId()) && !fullPricePetsAllowed(setup, fragments)) {
          need = 0;
        }
        if (need > 0) neededIds.push(petId);
        useful += Math.min(Number(amount), need);
      }
    }
    const cost = Number(slot.cost?.coin?.[1080] ?? 0);
    const effectiveCost = cost - resale;
    return { cost, useful, effectiveCost, neededIds, price: useful > 0 ? effectiveCost / useful : Infinity };
  }
  async function buySlot(shopId, slot) {
    await beforeStallAction();
    return await Caller.send({ name: "shopBuy", args: { shopId, slot: slot.id, cost: slot.cost, reward: {} } });
  }
  function lotUnits(slot) {
    return [...Object.keys(slot.reward?.invasionFragmentHero ?? {}), ...Object.keys(slot.reward?.invasionFragmentPet ?? {})].join("+");
  }
  async function pinSlot(shopId, slot) {
    await beforeStallAction();
    await Caller.send({ name: "shop_pinSlot", args: { shopId, slotId: slot.id } });
    slot.pinned = true;
  }
  async function unpinSlot(shopId, slot) {
    await beforeStallAction();
    await Caller.send({ name: "shop_unpinSlot", args: { shopId, slotId: slot.id } });
    slot.pinned = false;
  }
  async function sellWhole(fragments, unitId, amount) {
    await beforeStallAction();
    const answer = await Caller.send({ name: "invasion_fragmentSell", args: { fragmentId: unitId, amount } });
    fragments[unitId] = 0;
    return coinsOf(answer);
  }
  function usefulSlots(shopSlots, setup, fragments, carryOnly, waitPetDiscount = false) {
    const result = [];
    for (const slot of shopSlots) {
      if (slot.bought) continue;
      if (slot.reward?.invasionFragmentHeroRand) continue;
      const value = slotValue(slot, setup, fragments, carryOnly, waitPetDiscount);
      if (value.useful <= 0 || value.cost <= 0) continue;
      result.push({ slot, ...value });
    }
    return result;
  }
  function countSources(candidates) {
    const sources = {};
    for (const candidate of candidates) {
      for (const id of candidate.neededIds) {
        sources[id] = (sources[id] ?? 0) + 1;
      }
    }
    return sources;
  }
  function pickBestSlot(shopSlots, setup, fragments, coins, carryOnly, waitPetDiscount = false, cheapestFirst = false) {
    const candidates = usefulSlots(shopSlots, setup, fragments, carryOnly, waitPetDiscount);
    if (candidates.length === 0) return null;
    const sources = countSources(candidates);
    const affordable = candidates.filter((e) => coins.value >= e.cost);
    if (affordable.length === 0) return null;
    const soleSource = cheapestFirst ? [] : affordable.filter((e) => e.neededIds.some((id) => sources[id] === 1));
    const pool = soleSource.length > 0 ? soleSource : affordable;
    let best = null;
    for (const candidate of pool) {
      const better = !best || candidate.price < best.price || candidate.price === best.price && candidate.cost < best.cost;
      if (better) best = candidate;
    }
    if (best) best.isSoleSource = soleSource.includes(best);
    return best;
  }
  async function releasePins(shopId, shopSlots) {
    for (const slot of shopSlots) {
      if (sessionState.stopped) break;
      if (!slot.pinned || slot.bought) continue;
      await unpinSlot(shopId, slot);
      console.log(`Сняли закреп с ${lotUnits(slot)}, слот ${slot.id}: закупка без закрепов`);
    }
  }
  async function buyForArchdemonNew(setup, attempt, { discountPets = false, minCoins = null, shopSlots: openedSlots = null, onTalismans = null } = {}) {
    const shopId = stallShopId();
    if (!shopId) return { coins: wallet.value };
    let shopSlots = openedSlots;
    if (!shopSlots) {
      const visit = await openStallVisit(shopId, onTalismans);
      if (visit.reason) return { coins: wallet.value, reason: visit.reason };
      shopSlots = visit.slots;
    }
    const fragments = (await readOwnedUnits()).fragments;
    const coins = wallet;
    let tick = 0;
    let guard = 0;
    let petDeposit = discountPets;
    let pinsReleased = false;
    while (guard < 300) {
      guard++;
      if (sessionState.stopped) break;
      const state = collectedState(setup, fragments);
      if (state.done) break;
      if (minCoins != null) {
        const resale = extrasResale(setup, fragments);
        const projected = coins.value + resale + NX_MIN_COINS_SLACK;
        if (projected < minCoins) {
          const numbers = { coins: coins.value, resale, slack: NX_MIN_COINS_SLACK, projected, min: minCoins };
          console.log(
            `${NX_LOG_CASH} граница закупки: ${coins.value} + продажа ${resale} + запас ${NX_MIN_COINS_SLACK} = ${projected} < ${minCoins}, заход заново`
          );
          return { coins: coins.value, reason: I18N("NX_REASON_MIN_COINS_UNREACHABLE", numbers) };
        }
      }
      if (coins.value < NX_MIN_LOT_COST && !petDeposit) break;
      archdemonNewProgress(
        I18N("NX_SHOPPING", {
          attempt,
          coins: coins.value,
          heroes: state.heroesLeft.length,
          pets: state.petsLeft.length
        }) + ".".repeat(tick % 3 + 1),
        "shopping"
      );
      tick++;
      const bought = await buySlotsForArchdemonNew(shopId, coins, shopSlots, setup, fragments, discountPets);
      if (bought) {
        await sellUnneededFragments(setup, fragments, false, coins);
        continue;
      }
      if (petDeposit) {
        await buyDiscountedPets(shopId, coins, shopSlots, fragments);
        const neededLeft = usefulSlots(shopSlots, setup, fragments, false, discountPets).length > 0;
        if (neededLeft || coins.value < NX_MIN_LOT_COST + NX_STALL_REFRESH_COST) {
          petDeposit = false;
          console.log("Монет не хватает, забираем залог: продаём лишних питомцев и дальше их не скупаем");
          if (await sellExtraPets(setup, fragments, coins) > 0) continue;
        }
      }
      if (coins.value >= NX_MIN_LOT_COST + NX_STALL_REFRESH_COST) {
        if (!pinsReleased) {
          await releasePins(shopId, shopSlots);
          pinsReleased = true;
        }
        const beforeRefresh = coins.value;
        shopSlots = await refreshStall(shopId, coins);
        ledgerAdd("обновления лавки", coins.value - beforeRefresh);
        if (!shopSlots) break;
      } else {
        break;
      }
    }
    return { coins: coins.value };
  }
  function extrasResale(setup, fragments) {
    const heroPrice = fragmentSellPrice("hero");
    const petPrice = fragmentSellPrice("pet");
    let resale = 0;
    for (const [id, count] of Object.entries(fragments)) {
      const unitId = Number(id);
      const have = Number(count);
      if (have <= 0) continue;
      if (unitId >= NX_PET_ID_THRESHOLD) {
        if (!setup.petsToCollect.includes(unitId)) resale += have * petPrice;
        continue;
      }
      if (keepAmountFor(setup, unitId, false) === 0) resale += have * heroPrice;
    }
    return resale;
  }
  async function buySlotsForArchdemonNew(shopId, coins, shopSlots, setup, fragments, waitPetDiscount = false) {
    let bought = false;
    try {
      let guard = 0;
      while (guard < 60) {
        guard++;
        if (sessionState.stopped) break;
        if (collectedState(setup, fragments).done) break;
        const best = pickBestSlot(shopSlots, setup, fragments, coins, false, waitPetDiscount, true);
        if (!best) break;
        await buySlot(shopId, best.slot);
        coins.value -= best.cost;
        ledgerAdd("основной пак", -best.cost);
        best.slot.bought = true;
        bought = true;
        applyReward(fragments, best.slot.reward);
        console.log(
          `${NX_LOG_CASH} -${best.cost} основной пак ${lotUnits(best.slot)}, полезных ${best.useful}, чистая ${best.effectiveCost}, остаток ${coins.value}` + (best.isSoleSource ? ", единственный источник" : "")
        );
      }
    } catch (e) {
      console.error(e);
      coins.value = await walletLoad();
    }
    return bought;
  }
  async function sellUnneededFragments(setup, fragments, keepCarry, coins = wallet) {
    let sold = 0;
    let income = 0;
    for (const [id, count] of Object.entries(fragments)) {
      if (sessionState.stopped) break;
      const fragmentId = Number(id);
      const have = Number(count);
      if (have <= 0) continue;
      if (fragmentId >= NX_PET_ID_THRESHOLD) continue;
      if (keepAmountFor(setup, fragmentId, keepCarry) > 0) continue;
      income += await sellWhole(fragments, fragmentId, have);
      sold += have;
      console.log(`Продали героя ${fragmentId} целиком, фрагментов ${have}`);
    }
    if (sold > 0) {
      coins.value += income;
      ledgerAdd("продажи", income);
      console.log(`${NX_LOG_CASH} +${income} продажа ${sold} фрагментов, остаток ${coins.value}`);
    }
    return sold;
  }
  async function sellExtraPets(setup, fragments, coins = wallet) {
    const extra = Object.entries(fragments).map(([id, count]) => [Number(id), Number(count)]).filter(([id, count]) => id >= NX_PET_ID_THRESHOLD && count > 0 && !setup.petsToCollect.includes(id));
    if (extra.length === 0) return 0;
    let sold = 0;
    let income = 0;
    for (const [petId, count] of extra) {
      if (sessionState.stopped) break;
      income += await sellWhole(fragments, petId, count);
      sold += count;
      console.log(`Продали лишнего питомца ${petId}`);
    }
    coins.value += income;
    ledgerAdd("продажа питомцев", income);
    console.log(`${NX_LOG_CASH} +${income} продажа ${sold} питомцев, остаток ${coins.value}`);
    return sold;
  }
  async function buyCarryHeroes(shopId, coins, shopSlots, setup, fragments) {
    let guard = 0;
    while (guard < 20) {
      guard++;
      if (sessionState.stopped) break;
      if (carryPackReady(setup, fragments)) break;
      const best = pickBestSlot(shopSlots, setup, fragments, coins, true);
      if (!best) break;
      await buySlot(shopId, best.slot);
      coins.value -= best.cost;
      ledgerAdd("проходные", -best.cost);
      best.slot.bought = true;
      applyReward(fragments, best.slot.reward);
      console.log(
        `${NX_LOG_CASH} -${best.cost} проходной лот ${Object.keys(best.slot.reward?.invasionFragmentHero ?? {}).join("+")}, полезных ${best.useful}, чистая ${best.effectiveCost}, остаток ${coins.value}`
      );
    }
  }
  async function buyCarryRanks(shopId, coins, shopSlots, setup, fragments) {
    let guard = 0;
    while (guard < 20) {
      guard++;
      if (sessionState.stopped) break;
      const best = pickBestSlot(shopSlots, setup, fragments, coins, "rank");
      if (!best) break;
      await buySlot(shopId, best.slot);
      coins.value -= best.cost;
      ledgerAdd("проходные до ранга", -best.cost);
      best.slot.bought = true;
      applyReward(fragments, best.slot.reward);
      console.log(
        `${NX_LOG_CASH} -${best.cost} проходной до ранга ${Object.keys(best.slot.reward?.invasionFragmentHero ?? {}).join("+")}, полезных ${best.useful}, чистая ${best.effectiveCost}, остаток ${coins.value}`
      );
    }
  }
  async function buySacrificeHero(shopId, coins, shopSlots, setup, fragments) {
    const heroId = sacrificeHeroOf(setup);
    if (!heroId || Number(fragments[heroId] ?? 0) > 0) return false;
    let best = null;
    for (const slot of shopSlots) {
      if (slot.bought || slot.reward?.invasionFragmentHeroRand) continue;
      const heroes = slot.reward?.invasionFragmentHero ?? {};
      if (!heroes[heroId]) continue;
      const cost = Number(slot.cost?.coin?.[1080] ?? 0);
      if (!cost || coins.value < cost) continue;
      const others = Object.entries(heroes).reduce(
        (sum, [id, amount]) => sum + (Number(id) === heroId || keepAmountFor(setup, Number(id), true) > 0 ? 0 : Number(amount)),
        0
      );
      const effective = cost - others * fragmentSellPrice("hero");
      if (!best || effective < best.effective) best = { slot, cost, effective };
    }
    if (!best) return false;
    await buySlot(shopId, best.slot);
    coins.value -= best.cost;
    best.slot.bought = true;
    applyReward(fragments, best.slot.reward);
    ledgerAdd("герой для слива", -best.cost);
    console.log(`${NX_LOG_CASH} -${best.cost} герой для слива ${heroId}, чистая ${best.effective}, остаток ${coins.value}`);
    return true;
  }
  async function buyCheapLots(shopId, coins, shopSlots, setup, fragments) {
    for (const slot of shopSlots) {
      if (sessionState.stopped) break;
      if (slot.bought) continue;
      const heroes = slot.reward?.invasionFragmentHero;
      if (!heroes || slot.reward?.invasionFragmentPet) continue;
      const count = Object.entries(heroes).reduce(
        (sum, [id, amount]) => sum + (keepAmountFor(setup, Number(id), true) > 0 ? 0 : Number(amount)),
        0
      );
      const resale = count * fragmentSellPrice("hero");
      const cost = Number(slot.cost?.coin?.[1080] ?? 0);
      if (!cost || cost >= resale || coins.value < cost) continue;
      await buySlot(shopId, slot);
      coins.value -= cost;
      slot.bought = true;
      applyReward(fragments, slot.reward);
      ledgerAdd("перепродажа", -cost);
      console.log(`${NX_LOG_CASH} -${cost} на перепродажу ${Object.keys(heroes).join("+")}, вернёт от ${resale}, остаток ${coins.value}`);
    }
  }
  async function buyAllRandomLots(shopId, coins, shopSlots, fragments, buyAny = false) {
    const resale = randomLotResale();
    let bought = 0;
    let cheap = 0;
    for (const slot of shopSlots) {
      if (sessionState.stopped) break;
      if (slot.bought) continue;
      if (!slot.reward?.invasionFragmentHeroRand) continue;
      const cost = slot.cost?.coin?.[1080];
      if (!cost) continue;
      if (!buyAny && cost >= resale) {
        console.log(`Неизвестная карта за ${cost} пропущена: продажа вернёт ${resale}, это минус`);
        continue;
      }
      if (coins.value < cost) continue;
      const result = await buySlot(shopId, slot);
      coins.value -= cost;
      slot.bought = true;
      bought++;
      if (cost < resale) cheap++;
      ledgerAdd("неизвестные карты", -cost);
      applyReward(fragments, result);
      console.log(
        `${NX_LOG_CASH} -${cost} неизвестная карта ${Object.keys(result?.invasionFragmentHero ?? {}).join("+")}, остаток ${coins.value}`
      );
    }
    return { bought, cheap };
  }
  function preFinalNeed(setup, fragments, heroId) {
    const carryTarget = setup.carryHeroes?.includes(heroId) ? Number(setup.carryTargets?.[heroId] ?? 1) : 0;
    const need = Math.max(Number(setup.targets[heroId] ?? 0), sacrificeNeedFor(setup, {}, heroId), carryTarget);
    return Math.max(0, need - Number(fragments[heroId] ?? 0));
  }
  function planStallPins(shopSlots, setup, fragments) {
    const remaining = {};
    const candidates = [];
    for (const slot of shopSlots) {
      if (slot.bought || slot.reward?.invasionFragmentHeroRand) continue;
      const heroes = slot.reward?.invasionFragmentHero;
      if (!heroes) continue;
      const ids = Object.keys(heroes).map(Number);
      for (const id of ids) if (remaining[id] === void 0) remaining[id] = preFinalNeed(setup, fragments, id);
      if (ids.some((id) => remaining[id] > 0)) candidates.push(slot);
    }
    const heroPrice = fragmentSellPrice("hero");
    const score = (slot) => {
      let useful = 0;
      let resale = 0;
      for (const [id, amount] of Object.entries(slot.reward.invasionFragmentHero)) {
        const heroId = Number(id);
        const count = Number(amount);
        const part = Math.min(count, remaining[heroId] ?? 0);
        useful += part;
        if (keepAmountFor(setup, heroId, false) === 0) resale += (count - part) * heroPrice;
      }
      const cost = Number(slot.cost?.coin?.[1080] ?? 0);
      return { useful, cost, price: useful > 0 ? (cost - resale) / useful : Infinity };
    };
    const chosen = [];
    for (; ; ) {
      let best = null;
      for (const slot of candidates) {
        if (chosen.includes(slot)) continue;
        const value = score(slot);
        if (value.useful <= 0) continue;
        const rank = value.useful >= 2 ? 0 : 1;
        const better = !best || rank < best.rank || rank === best.rank && (value.price < best.price || value.price === best.price && (value.cost < best.cost || value.cost === best.cost && slot.pinned && !best.slot.pinned));
        if (better) best = { slot, rank, ...value };
      }
      if (!best) break;
      chosen.push(best.slot);
      for (const [id, amount] of Object.entries(best.slot.reward.invasionFragmentHero)) {
        const heroId = Number(id);
        remaining[heroId] = Math.max(0, (remaining[heroId] ?? 0) - Number(amount));
      }
    }
    return chosen;
  }
  async function applyStallPins(shopId, shopSlots, setup, fragments) {
    const keep = new Set(planStallPins(shopSlots, setup, fragments));
    const petsOf = (slot) => Object.keys(slot.reward?.invasionFragmentPet ?? {}).map(Number);
    const neededPet = (id) => setup.petsToCollect.includes(id) && !(Number(fragments[id] ?? 0) > 0);
    for (const slot of shopSlots) {
      if (sessionState.stopped) return;
      if (!slot.pinned || slot.bought) continue;
      const pets = petsOf(slot);
      const isPetSlot = pets.length > 0 && !slot.reward?.invasionFragmentHero;
      if (isPetSlot ? pets.some(neededPet) : keep.has(slot)) continue;
      await unpinSlot(shopId, slot);
      console.log(`Сняли закреп с ${lotUnits(slot)}, слот ${slot.id}: ${isPetSlot ? "питомец не нужен" : "не нужен или есть дешевле"}`);
    }
    for (const slot of keep) {
      if (sessionState.stopped) return;
      if (slot.pinned) continue;
      await pinSlot(shopId, slot);
      console.log(`Закрепили ${lotUnits(slot)} за ${slot.cost?.coin?.[1080]}, слот ${slot.id}`);
    }
    const pledgedPets = new Set(shopSlots.filter((slot) => slot.pinned && !slot.bought).flatMap(petsOf));
    for (const slot of shopSlots) {
      if (sessionState.stopped) return;
      if (slot.bought || slot.pinned || !isDiscountedPetSlot(slot, shopId)) continue;
      const pets = petsOf(slot).filter((id) => neededPet(id) && !pledgedPets.has(id));
      if (pets.length === 0) continue;
      try {
        await pinSlot(shopId, slot);
      } catch (e) {
        console.error(e);
        return;
      }
      pets.forEach((id) => pledgedPets.add(id));
      console.log(`Закрепили нужного питомца со скидкой ${pets.join("+")}, слот ${slot.id}`);
    }
  }
  async function buyDiscountedPets(shopId, coins, shopSlots, fragments) {
    const sellPrice = fragmentSellPrice("pet");
    let bought = 0;
    for (const slot of shopSlots) {
      if (sessionState.stopped) break;
      if (slot.bought || !isDiscountedPetSlot(slot, shopId)) continue;
      const pets = slot.reward.invasionFragmentPet;
      if (Object.keys(pets).every((id) => Number(fragments[Number(id)] ?? 0) > 0)) continue;
      const cost = Number(slot.cost?.coin?.[1080] ?? 0);
      if (coins.value < cost) continue;
      await buySlot(shopId, slot);
      coins.value -= cost;
      slot.bought = true;
      applyReward(fragments, slot.reward);
      ledgerAdd("питомцы со скидкой", -cost);
      bought++;
      const count = Object.values(pets).reduce((sum, amount) => sum + Number(amount), 0);
      console.log(
        `${NX_LOG_CASH} -${cost} питомец со скидкой ${Object.keys(pets).join("+")}, продажа вернёт ${count * sellPrice}, остаток ${coins.value}`
      );
    }
    return bought;
  }

  // src/runDefault.js
  async function runArchdemonNewChapterDefault(setup, attempt) {
    archdemonNewProgress(I18N("NX_ENTERING", { attempt }));
    await new Promise((e) => setTimeout(e, 3e3));
    if (sessionState.stopped) return { ok: false, reason: I18N("NX_REASON_STOPPED") };
    let chapterInfo;
    try {
      chapterInfo = await Caller.send({ name: "invasion_setActiveChapter", args: { chapterId: setup.chapterId } });
    } catch (e) {
      console.error(e);
      return { fatal: true };
    }
    setOwnedFragments(chapterInfo.invasion.fragments);
    await walletOnChapterEntry(chapterInfo, attempt > 1);
    const actions = Object.values(chapterInfo.invasion.actions);
    const lastMission = actions[actions.length - 1];
    const lastMissionId = lastMission.payload.id;
    let missionId = actions[0].payload.id;
    let missionNumber = 1;
    let lives = chapterInfo.invasion.lives;
    const takenRolls = [];
    await pause(NX_PACE.chapterEnter);
    while (lives > 0) {
      if (sessionState.stopped) return { ok: false, reason: I18N("NX_REASON_STOPPED") };
      const shopping = await buyForArchdemonNew(setup, attempt, {
        onTalismans: (offered) => chooseTalisman(setup, offered, takenRolls)
      });
      if (shopping.reason) return { ok: false, reason: shopping.reason };
      if (sessionState.stopped) return { ok: false, reason: I18N("NX_REASON_STOPPED") };
      if (missionId === lastMissionId) {
        return await checkArchdemonNewConditions(setup);
      }
      archdemonNewProgress(I18N("NX_MISSION", { attempt, missionNumber }));
      await pause(NX_PACE.beforeBattle);
      const have = await readOwnedUnits();
      let heroes = have.bestFive;
      if (setup.heroes.every((id) => have.heroIds.includes(id))) {
        heroes = setup.heroes;
      }
      const havePets = have.pets;
      let pet;
      if (havePets.length > 0) {
        pet = havePets.includes(setup.mainPet) ? setup.mainPet : havePets[0];
      }
      const petsFavor = {};
      for (const heroId of heroes) {
        const petId = Number(setup.favor[heroId] ?? 0);
        if (petId > 0 && havePets.includes(petId)) {
          petsFavor[heroId] = petId;
        }
      }
      const fight = await fightPoint(missionId, setup.chapterId, heroes, pet, petsFavor);
      if (fight.error || !fight.info) return { fatal: true };
      if (fight.invalid) return { fatal: true, message: I18N("NX_ERR_RESULT_INVALID") };
      const info = fight.info;
      lives = info.lives;
      if (sessionState.stopped) return { ok: false, reason: I18N("NX_REASON_STOPPED") };
      if (lives === 0) return { ok: false, reason: I18N("NX_REASON_NO_LIVES") };
      const missions = Object.values(info.actions);
      const nextMissionIndex = missions.findIndex((e) => e.payload.wins === 0);
      if (nextMissionIndex === -1) return { ok: false, reason: I18N("NX_REASON_NO_MISSIONS") };
      missionId = missions[nextMissionIndex].payload.id;
      missionNumber = nextMissionIndex + 1;
      await pause(NX_PACE.afterBattle);
    }
    return { ok: false, reason: I18N("NX_REASON_NO_LIVES") };
  }

  // src/runWealth.js
  async function wealthShopPhase(setup, point, attempt, { sacrificePoint = 0, takenRolls = [] } = {}) {
    const shopId = stallShopId();
    if (!shopId) return { fatal: true };
    try {
      const opened = await openStallVisit(shopId, (offered) => chooseTalisman(setup, offered, takenRolls));
      if (opened.reason) return { reason: opened.reason };
      let shopSlots = opened.slots;
      const coins = wallet;
      const coinsOnEntry = coins.value;
      const fragments = (await readOwnedUnits()).fragments;
      archdemonNewProgress(I18N("NX_WEALTH_SHOP", { attempt, point, coins: coins.value }));
      if (point !== 1) {
        await buyCarryRanks(shopId, coins, shopSlots, setup, fragments);
        await buyCheapLots(shopId, coins, shopSlots, setup, fragments);
        await sellUnneededFragments(setup, fragments, true, coins);
        await applyStallPins(shopId, shopSlots, setup, fragments);
        if (point === sacrificePoint) {
          const found = await ensureSacrificeHero(setup, attempt, { shopId, coins, shopSlots, fragments });
          if (found.fatal || found.reason) return found;
        }
        return { coins: coins.value, coinsOnEntry };
      }
      const missingMain = () => setup.carryHeroes.filter((id) => Number(fragments[id] ?? 0) <= 0);
      const needExtra = () => (setup.carryExtraHeroes ?? []).length > 0 && !carryExtraOwned(setup, fragments);
      let refreshes = 0;
      let budgetLeft = Number(setup.startRefreshes ?? 0);
      console.log(
        `Точка 1: старт, монет ${coins.value}, ищем проходных ${setup.carryHeroes.join(", ")}`
      );
      while (refreshes <= NX_POINT1_MAX_REFRESHES) {
        if (sessionState.stopped) break;
        const passStartCoins = coins.value;
        await buyCarryHeroes(shopId, coins, shopSlots, setup, fragments);
        if (carryPackReady(setup, fragments)) await buyCarryRanks(shopId, coins, shopSlots, setup, fragments);
        await buyCheapLots(shopId, coins, shopSlots, setup, fragments);
        const random = await buyAllRandomLots(shopId, coins, shopSlots, fragments, setup.buyAnyRandomLots === true);
        await sellUnneededFragments(setup, fragments, true, coins);
        await applyStallPins(shopId, shopSlots, setup, fragments);
        console.log(
          `${NX_LOG_CASH} ИТОГ круга ${refreshes + 1}: было ${passStartCoins}, стало ${coins.value}, разница ${coins.value - passStartCoins}, неизвестных взято ${random.bought}, из них дешевле ${randomLotResale()}: ${random.cheap}`
        );
        if (carryPackReady(setup, fragments)) break;
        let fromBudget = false;
        if (random.cheap < NX_LOTS_PER_EARNED_REFRESH) {
          if (budgetLeft <= 0) {
            console.log(
              `Точка 1: за круг взято неизвестных карт дешевле ${randomLotResale()}: ${random.cheap}, для обновления нужно ${NX_LOTS_PER_EARNED_REFRESH}, запас пуст. Круг закончен, монет ${coins.value}`
            );
            break;
          }
          budgetLeft--;
          fromBudget = true;
        }
        if (coins.value < NX_STALL_REFRESH_COST + NX_MIN_LOT_COST) {
          console.log(`Точка 1: монет ${coins.value}, на обновление и лот не хватает. Круг закончен`);
          break;
        }
        refreshes++;
        console.log(
          `Точка 1: обновление ${refreshes} ${fromBudget ? "из запаса, осталось " + budgetLeft : "заработано"}`
        );
        archdemonNewProgress(
          I18N("NX_POINT1_REFRESH", { attempt, refreshes, bought: random.cheap, coins: coins.value })
        );
        const beforeRefresh = coins.value;
        const refreshed = await refreshStall(shopId, coins);
        ledgerAdd("обновления лавки", coins.value - beforeRefresh);
        if (!refreshed) break;
        shopSlots = refreshed;
      }
      if (missingMain().length > 0) {
        return {
          reason: I18N("NX_REASON_NO_CARRY", { list: missingMain().map(unitName).join(", ") })
        };
      }
      if (needExtra()) {
        return {
          reason: I18N("NX_REASON_NO_CARRY_EXTRA", {
            list: (setup.carryExtraHeroes ?? []).map(unitName).join(", ")
          })
        };
      }
      console.log(`Точка 1: проходные собраны, обновлений потрачено ${refreshes}`);
      return { coins: coins.value, coinsOnEntry };
    } catch (e) {
      console.error(e);
      return { fatal: true };
    }
  }
  async function ensureSacrificeHero(setup, attempt, visit) {
    const heroId = sacrificeHeroOf(setup);
    const { shopId, coins, fragments } = visit;
    if (!heroId || Number(fragments[heroId] ?? 0) > 0) return {};
    let shopSlots = visit.shopSlots;
    try {
      const limit = Number(setup.sacrificeRefreshes ?? 0);
      let refreshes = 0;
      for (; ; ) {
        if (sessionState.stopped) return {};
        if (await buySacrificeHero(shopId, coins, shopSlots, setup, fragments)) {
          await sellUnneededFragments(setup, fragments, true, coins);
          console.log(`Герой для слива куплен, обновлений потрачено ${refreshes}`);
          return {};
        }
        if (refreshes >= limit || coins.value < NX_STALL_REFRESH_COST + NX_MIN_LOT_COST) break;
        refreshes++;
        archdemonNewProgress(I18N("NX_SACRIFICE_REFRESH", { attempt, refreshes, max: limit }));
        await applyStallPins(shopId, shopSlots, setup, fragments);
        const beforeRefresh = coins.value;
        const refreshed = await refreshStall(shopId, coins);
        ledgerAdd("обновления лавки", coins.value - beforeRefresh);
        if (!refreshed) break;
        shopSlots = refreshed;
      }
      console.log(`Героя для слива ${heroId} нет в лавке, обновлений потрачено ${refreshes} из ${limit}`);
      return { reason: I18N("NX_REASON_NO_SACRIFICE", { list: unitName(heroId) }) };
    } catch (e) {
      console.error(e);
      return { fatal: true };
    }
  }
  async function wealthFinalShopping(setup, attempt, shopSlots) {
    try {
      const fragments = (await readOwnedUnits()).fragments;
      archdemonNewProgress(I18N("NX_WEALTH_FINAL", { attempt }));
      await sellUnneededFragments(setup, fragments, false);
      const shopping = await buyForArchdemonNew(setup, attempt, { discountPets: true, minCoins: setup.minCoins ?? null, shopSlots });
      if (shopping.reason) return { reason: shopping.reason };
      await sellUnneededFragments(setup, fragments, false);
      await sellExtraPets(setup, fragments);
      console.log(`Финальная закупка закончена, монет осталось ${wallet.value}`);
      return {};
    } catch (e) {
      console.error(e);
      return { fatal: true };
    }
  }
  async function buildCarryTeam(setup) {
    const have = await readOwnedUnits();
    let heroes = setup.carryHeroes.filter((id) => have.heroIds.includes(id));
    const extra = (setup.carryExtraHeroes ?? []).find((id) => have.heroIds.includes(id));
    if (extra !== void 0) {
      heroes = [...heroes, extra];
    }
    if (heroes.length === 0) {
      heroes = have.bestFive;
    }
    const havePets = have.pets;
    let pet;
    if (havePets.length > 0) {
      pet = havePets.includes(setup.mainPet) ? setup.mainPet : havePets[0];
    }
    const favor = {};
    for (const heroId of heroes) {
      const petId = Number(setup.favor[heroId] ?? 0);
      if (petId > 0 && havePets.includes(petId)) {
        favor[heroId] = petId;
      }
    }
    return { heroes, pet, favor };
  }
  async function showAfterBossReport(setup, attempt, slots) {
    const coins = wallet.value;
    console.log(`${NX_LOG_CASH} баланс, отчёт перед Архидемоном: ${coins}`);
    const pinnedLines = [];
    for (const slot of slots ?? []) {
      if (!slot.pinned) continue;
      const ids = Object.keys(slot.reward?.invasionFragmentHero ?? {}).map(Number);
      const cost = slot.cost?.coin?.[1080] ?? "?";
      pinnedLines.push(`${ids.map(unitName).join(" + ")} — ${cost}`);
    }
    const fragments = (await readOwnedUnits()).fragments;
    const heroLines = setup.heroes.map(
      (id) => `${unitName(id)}: ${Number(fragments[id] ?? 0)} из ${setup.targets[id]}`
    );
    const petLines = setup.petsToCollect.map(
      (id) => `${unitName(id)}: ${Number(fragments[id] ?? 0) > 0 ? "есть" : "нет"}`
    );
    const carryLines = setup.carryHeroes.map((id) => `${unitName(id)}: ${Number(fragments[id] ?? 0)} из ${Number(setup.carryTargets?.[id] ?? 1)}`);
    const books = ledgerSummary(coins);
    const bookLines = [
      `старт захода: ${books.start}`,
      ...books.entries.map(([name2, value]) => `${name2}: ${value > 0 ? "+" : ""}${value}`),
      `итого мои движения: ${books.mine > 0 ? "+" : ""}${books.mine}`,
      `приход с точек: +${books.fromPoints}`
    ];
    console.log(`${NX_LOG_CASH} СВОД`, books);
    const small = (lines) => lines.map((e) => `<div style="font-size: 13px;">${e}</div>`).join("");
    const body = `<div style="text-align: left;"><div style="font-size: 20px;">Монет: <span style="color: LimeGreen;">${coins}</span></div><div style="margin-top: 10px;">Куда ушли монеты:</div>` + small(bookLines) + `<div style="margin-top: 10px;">Закреплено слотов: <span style="color: LimeGreen;">${pinnedLines.length}</span></div>` + small(pinnedLines) + '<div style="margin-top: 10px;">Основной состав:</div>' + small(heroLines) + '<div style="margin-top: 10px;">Питомцы:</div>' + small(petLines) + '<div style="margin-top: 10px;">Проходные:</div>' + small(carryLines) + "</div>";
    console.log("Отчёт перед Архидемоном", { coins, pinned: pinnedLines, heroLines, petLines, carryLines });
    setProgress("", true);
    const answer = await popup.confirm(I18N("NX_AFTER_BOSS_REPORT", { attempt, body }), [
      { msg: I18N("NX_CONTINUE"), result: "continue", color: "green" },
      { msg: I18N("NX_HALT"), result: "halt", isCancel: true, color: "red" }
    ]);
    return { decision: answer === "continue" ? "continue" : "halt" };
  }
  async function runArchdemonNewChapterWealth(setup, attempt) {
    archdemonNewProgress(I18N("NX_ENTERING", { attempt }));
    await new Promise((e) => setTimeout(e, 3e3));
    if (sessionState.stopped) return archdemonNewStoppedResult();
    let chapterInfo;
    try {
      chapterInfo = await Caller.send({ name: "invasion_setActiveChapter", args: { chapterId: setup.chapterId } });
      setOwnedFragments(chapterInfo.invasion.fragments);
      await walletOnChapterEntry(chapterInfo, attempt > 1);
    } catch (e) {
      console.error(e);
      return { fatal: true };
    }
    const actions = Object.values(chapterInfo.invasion.actions);
    let lives = chapterInfo.invasion.lives;
    const takenRolls = [];
    ledgerReset(wallet.value);
    console.log(
      `${NX_LOG_CASH} СТАРТ захода ${attempt}: ${sessionState.startCoins} монет, жизней ${lives}, сборка расширения ${GM_info.script.version}`
    );
    const lastPoint = actions.length - 1;
    const sacrificePoint = lastPoint;
    await pause(NX_PACE.chapterEnter);
    let visit = await wealthShopPhase(setup, 1, attempt, { sacrificePoint, takenRolls });
    if (visit.fatal) return { fatal: true };
    if (visit.reason) return { ok: false, reason: visit.reason };
    for (let point = 1; point <= lastPoint; point++) {
      if (sessionState.stopped) return archdemonNewStoppedResult();
      const action = actions[point - 1];
      if (!action) return { ok: false, reason: I18N("NX_REASON_NO_MISSIONS") };
      const missionId = action.payload.id;
      if (point === sacrificePoint) {
        const ownedHeroes = (await readOwnedUnits()).heroIds;
        const sacrificeTeam = setup.sacrificeHeroes.filter((id) => ownedHeroes.includes(id));
        if (sacrificeTeam.length === 0) {
          return {
            ok: false,
            reason: I18N("NX_REASON_NO_SACRIFICE", {
              list: setup.sacrificeHeroes.map(unitName).join(", ")
            })
          };
        }
        console.log(`Сливаем точку составом ${sacrificeTeam.join(", ")}`);
        for (let number = 1; number <= NX_SACRIFICE_LOSSES; number++) {
          if (sessionState.stopped) return archdemonNewStoppedResult();
          archdemonNewProgress(
            I18N("NX_SACRIFICE", { attempt, number, total: NX_SACRIFICE_LOSSES })
          );
          await pause(NX_PACE.beforeBattle);
          const coinsBeforeLoss = visit.coins;
          const teamKey = sacrificeTeam.join("+");
          const loss = await loseBattleOnPurpose(missionId, setup.chapterId, sacrificeTeam, sessionState.lossStart[teamKey]);
          if (loss?.lossTimer != null) sessionState.lossStart[teamKey] = nextLossStart(loss.lossTimer);
          if (!loss?.info) return { fatal: true };
          if (loss.invalid) return { fatal: true, message: I18N("NX_ERR_RESULT_INVALID") };
          const calcSaysWin = loss.calcSaysWin;
          const afterLoss = loss.info;
          lives = afterLoss.lives;
          const pointState = Object.values(afterLoss.actions).find((e) => e.payload.id === missionId);
          const pointTaken = pointState ? Number(pointState.payload.wins ?? 0) > 0 : false;
          console.log(
            `Слив ${number} из ${NX_SACRIFICE_LOSSES}: расчёт ${calcSaysWin ? "победа" : "поражение"}, точка ${pointTaken ? "ВЗЯТА" : "не взята"}, жизней ${lives}`
          );
          if (pointTaken) {
            return { ok: false, reason: I18N("NX_REASON_SACRIFICE_WON") };
          }
          if (lives === 0) return { ok: false, reason: I18N("NX_REASON_NO_LIVES") };
          await pause(NX_PACE.afterBattle);
          visit = await wealthShopPhase(setup, point, attempt, { sacrificePoint, takenRolls });
          if (visit.fatal) return { fatal: true };
          if (visit.reason) return { ok: false, reason: visit.reason };
          console.log(
            `${NX_LOG_CASH} слив ${number}: было ${coinsBeforeLoss}, на входе в лавку ${visit.coinsOnEntry}, прирост ${visit.coinsOnEntry - coinsBeforeLoss}`
          );
        }
      }
      archdemonNewProgress(I18N("NX_MISSION", { attempt, missionNumber: point }));
      await pause(NX_PACE.beforeBattle);
      const team = await buildCarryTeam(setup);
      const fragmentsOwned = { ...(await readOwnedUnits()).fragments };
      const coinsBeforePoint = visit.coins;
      const fight = await fightPoint(missionId, setup.chapterId, team.heroes, team.pet, team.favor);
      if (fight.error || !fight.info) return { fatal: true };
      if (fight.invalid) return { fatal: true, message: I18N("NX_ERR_RESULT_INVALID") };
      const info = fight.info;
      lives = info.lives;
      const passed = Object.values(info.actions).find((e) => e.payload.id === missionId);
      console.log(`Точка ${point}, состояние от сервера:`, JSON.stringify(passed?.payload ?? null));
      if (passed && Number(passed.payload.wins ?? 0) === 0) {
        console.log(
          `%c${NX_LOG_BATTLE} точка ${point} ПРОИГРАНА`,
          "color: red; font-weight: bold;",
          "\n  герои: " + (team.heroes.length ? team.heroes.map(unitName).join(", ") : "пусто"),
          "\n  питомец: " + (team.pet ? unitName(team.pet) : "нет"),
          "\n  покровительство: " + (Object.keys(team.favor).length ? Object.entries(team.favor).map(([heroId, petId]) => `${unitName(heroId)} -> ${unitName(petId)}`).join("; ") : "нет"),
          "\n  фрагменты состава: " + team.heroes.map((id) => `${unitName(id)} ${Number(fragmentsOwned[id] ?? 0)}`).join(", ")
        );
        return { ok: false, reason: I18N("NX_REASON_POINT_LOST", { point }) };
      }
      if (lives === 0) return { ok: false, reason: I18N("NX_REASON_NO_LIVES") };
      if (sessionState.stopped) return archdemonNewStoppedResult();
      if (point < lastPoint) {
        await pause(NX_PACE.afterBattle);
        visit = await wealthShopPhase(setup, point + 1, attempt, { sacrificePoint, takenRolls });
        if (visit.fatal) return { fatal: true };
        if (visit.reason) return { ok: false, reason: visit.reason };
        console.log(
          `${NX_LOG_CASH} точка ${point}: было ${coinsBeforePoint}, на входе в лавку ${visit.coinsOnEntry}, прирост ${visit.coinsOnEntry - coinsBeforePoint}`
        );
      }
    }
    await pause(NX_PACE.afterBattle);
    if (sessionState.stopped) return archdemonNewStoppedResult();
    const shopId = stallShopId();
    if (!shopId) return { fatal: true };
    let finalVisit;
    try {
      finalVisit = await openStallVisit(shopId, (offered) => chooseTalisman(setup, offered, takenRolls));
    } catch (e) {
      console.error(e);
      return { fatal: true };
    }
    if (finalVisit.reason) return { ok: false, reason: finalVisit.reason };
    if (setup.pauseAfterBoss) {
      const report = await showAfterBossReport(setup, attempt, finalVisit.slots);
      if (report.decision !== "continue") {
        archdemonNewStop();
        return { ok: false, halted: true, reason: I18N("NX_REASON_STOPPED") };
      }
    }
    const finalOutcome = await wealthFinalShopping(setup, attempt, finalVisit.slots);
    if (finalOutcome.fatal) return { fatal: true };
    if (finalOutcome.reason) return { ok: false, reason: finalOutcome.reason };
    if (sessionState.stopped) return archdemonNewStoppedResult();
    return await checkArchdemonNewConditions(setup);
  }

  // src/loop.js
  async function runArchdemonNewChapter(setup, attempt) {
    if (setup.talismanId === NX_WEALTH_TALISMAN_ID) {
      return await runArchdemonNewChapterWealth(setup, attempt);
    }
    return await runArchdemonNewChapterDefault(setup, attempt);
  }
  async function runArchdemonNewLoop(setup) {
    sessionState.stopped = false;
    sessionState.lossStart = {};
    runLogOpen(archdemonNewStop);
    try {
      return await runLoopAttempts(setup);
    } finally {
      sessionState.lossStart = {};
      clearOwnedFragments();
      runLogClose();
    }
  }
  async function runLoopAttempts(setup) {
    let attempt = 0;
    let lastFailure = null;
    while (!sessionState.stopped) {
      attempt++;
      if (getChapterSealCost(setup.chapterId) > 0) {
        setProgress("", true);
        await popup.confirm(I18N("NX_ERR_PAID_CHAPTER"));
        syncGame();
        return returnToMenu();
      }
      runLogStartAttempt(attempt, lastFailure);
      const outcome = await runArchdemonNewChapter(setup, attempt);
      if (outcome.halted) {
        setProgress("", true);
        await popup.confirm(I18N("NX_HALTED_SYNC"));
        syncGame();
        return;
      }
      if (outcome.fatal) {
        setProgress("", true);
        await popup.confirm(outcome.message ?? I18N("NX_FAILED"));
        syncGame();
        return returnToMenu();
      }
      if (outcome.ok) {
        setProgress("", true);
        await popup.confirm(I18N("NX_READY", { attempt, coins: outcome.coins, percent: outcome.percent }));
        syncGame();
        return;
      }
      if (sessionState.stopped) break;
      runLogFail(I18N("NX_RETRY", { attempt, reason: outcome.reason }));
      lastFailure = { attempt, reason: outcome.reason };
      await new Promise((e) => setTimeout(e, 2500));
      if (sessionState.stopped) break;
      try {
        await Caller.send("invasion_resetChapter");
        const pause2 = NX_RUN_PAUSE_MIN_SECONDS + Math.random() * (NX_RUN_PAUSE_MAX_SECONDS - NX_RUN_PAUSE_MIN_SECONDS);
        const goOn = await runLogCountdown(pause2);
        if (!goOn) break;
      } catch (e) {
        console.error(e);
        setProgress("", true);
        await popup.confirm(I18N("NX_FAILED"));
        syncGame();
        return returnToMenu();
      }
    }
    setProgress("", true);
    await popup.confirm(I18N("NX_STOPPED", { attempt }));
    syncGame();
    return returnToMenu();
  }

  // src/frames.js
  var SQUAD_FRAMES = {
    purple: "linear-gradient(180deg, #E151D2 0%, #DA4BD2 8%, #CC42CE 19%, #C840CB 31%, #C135CE 42%, #B82BCE 53%, #AC21CF 64%, #A418D8 75%, #9A0ED2 86%, #770AB4 100%)",
    orange: "linear-gradient(180deg, #FDA42B 0%, #FBC170 11%, #FB9E1E 19%, #FD9E1C 28%, #FBAE3C 36%, #FFC069 44%, #DB8A09 53%, #C47602 61%, #9F5802 69%, #864203 78%, #A95403 86%, #DB8906 100%)",
    red: "linear-gradient(180deg, #F2532E 0%, #E74F2C 11%, #E14925 19%, #D54021 36%, #C9331D 53%, #B72618 69%, #AF1E10 86%, #A41515 100%)",
    /** Пустой слот: приглушённая рамка, чтобы было видно, что место свободно */
    empty: "linear-gradient(180deg, #4a3a5c 0%, #2a2038 100%)"
  };
  var RANKS = [
    { rank: 1, label: "80", frame: SQUAD_FRAMES.purple, plate: "linear-gradient(180deg, #d562e0, #7d1aae)", dot: "#b82bce", key: "NX_RANK_PURPLE", gameFrame: "border_hero_purple4", gamePlate: "level_purple", gameBg: "bg_hero_purple" },
    { rank: 3, label: "100", frame: SQUAD_FRAMES.orange, plate: "linear-gradient(180deg, #ffc15a, #c06a05)", dot: "#f0a020", key: "NX_RANK_YELLOW", gameFrame: "border_hero_gold3", gamePlate: "level_gold", gameBg: "bg_hero_orange" },
    { rank: 7, label: "130", frame: SQUAD_FRAMES.red, plate: "linear-gradient(180deg, #ff6a48, #a81a12)", dot: "#d63a22", key: "NX_RANK_RED", gameFrame: "border_hero_red3", gamePlate: "level_red", gameBg: "bg_hero_red" }
  ];
  var PET_GAME_ART = { frame: "border_pet_purple4", bg: "bg_pet_purple" };
  var PET_HEAD_FILE = "js/pet_icons/pet_icons";
  var petHeadSymbol = (petId) => `pet_50_${petId}`;
  function rankOf(fragments) {
    if (fragments >= 7) return RANKS[2];
    if (fragments >= 3) return RANKS[1];
    return RANKS[0];
  }
  function frameFor(fragments) {
    return rankOf(fragments).frame;
  }
  var OCTAGON = "polygon(22% 0, 78% 0, 100% 22%, 100% 78%, 78% 100%, 22% 100%, 0 78%, 0 22%)";

  // src/gameFiles.js
  function openCache() {
    return new Promise((resolve) => {
      let request;
      try {
        request = indexedDB.open("hw_cache");
      } catch (e) {
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => request.transaction.abort();
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
    });
  }
  async function readCacheRecords(keys) {
    const db = await openCache();
    if (!db) return keys.map(() => null);
    return new Promise((resolve) => {
      try {
        const store = db.transaction("cache", "readonly").objectStore("cache");
        const found = new Array(keys.length).fill(null);
        let left = keys.length;
        if (!left) {
          db.close();
          resolve(found);
          return;
        }
        keys.forEach((key, index) => {
          const get = store.get(key);
          const done = () => {
            left--;
            if (left === 0) {
              db.close();
              resolve(found);
            }
          };
          get.onsuccess = () => {
            found[index] = get.result ?? null;
            done();
          };
          get.onerror = done;
        });
      } catch (e) {
        db.close();
        resolve(keys.map(() => null));
      }
    });
  }
  async function listCacheKeys(prefix) {
    const db = await openCache();
    if (!db) return [];
    return new Promise((resolve) => {
      const keys = [];
      try {
        const range = IDBKeyRange.bound(prefix, prefix + "￿");
        const cursor = db.transaction("cache", "readonly").objectStore("cache").openKeyCursor(range);
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (c) {
            keys.push(String(c.key));
            c.continue();
          } else {
            db.close();
            resolve(keys);
          }
        };
        cursor.onerror = () => {
          db.close();
          resolve(keys);
        };
      } catch (e) {
        db.close();
        resolve(keys);
      }
    });
  }
  var hashedPaths = null;
  function buildHashedPaths() {
    const found = /* @__PURE__ */ new Map();
    const storage = typeof selfGame !== "undefined" ? selfGame["game.assets.storage.AssetStorage"] : null;
    const index = storage?.instance?.index;
    if (!index) return found;
    const hashed = /^(.+)\.[0-9a-f]{16,}(\.[A-Za-z0-9]+)$/;
    const seen = /* @__PURE__ */ new Set();
    const walk2 = (node, depth) => {
      if (!node || typeof node !== "object" || seen.has(node) || depth > 6) return;
      seen.add(node);
      for (const value of Object.values(node)) {
        if (typeof value === "string") {
          const m = hashed.exec(value);
          if (m) found.set(m[1] + m[2], value);
        } else if (value && typeof value === "object") {
          walk2(value, depth + 1);
        }
      }
    };
    try {
      walk2(index, 0);
    } catch (e) {
      console.error(e);
    }
    return found;
  }
  async function readDownloadBase() {
    const db = await openCache();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const range = IDBKeyRange.bound("hero_icons/", "hero_icons/￿");
        const cursor = db.transaction("cache", "readonly").objectStore("cache").openCursor(range);
        cursor.onsuccess = () => {
          const url = String(cursor.result?.value?.fullUrl ?? "");
          db.close();
          const at = url.indexOf("hero_icons/");
          if (at < 0) {
            resolve(null);
            return;
          }
          const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";
          resolve({ base: url.slice(0, at), query });
        };
        cursor.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch (e) {
        db.close();
        resolve(null);
      }
    });
  }
  var downloadBase;
  async function downloadUrlFor(plainPath) {
    hashedPaths ??= buildHashedPaths();
    if (downloadBase === void 0) downloadBase = await readDownloadBase();
    const hashed = hashedPaths.get(plainPath);
    return hashed && downloadBase ? downloadBase.base + hashed + downloadBase.query : "";
  }
  async function listGameFiles(prefix) {
    hashedPaths ??= buildHashedPaths();
    const all = new Set(await listCacheKeys(prefix));
    for (const path of hashedPaths.keys()) {
      if (path.startsWith(prefix)) all.add(path);
    }
    return [...all];
  }
  async function readGameFile(plainPath) {
    const [record] = await readCacheRecords([plainPath]);
    if (record?.data) return new Uint8Array(record.data);
    const url = await downloadUrlFor(plainPath);
    if (!url) return null;
    try {
      const response = await fetch(url);
      return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  // src/rsx.js
  var Reader = class {
    constructor(bytes, littleEndian) {
      this.bytes = bytes;
      this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      this.le = littleEndian;
      this.pos = 0;
    }
    u8() {
      return this.view.getUint8(this.pos++);
    }
    u16() {
      const v = this.view.getUint16(this.pos, this.le);
      this.pos += 2;
      return v;
    }
    i16() {
      const v = this.view.getInt16(this.pos, this.le);
      this.pos += 2;
      return v;
    }
    u32() {
      const v = this.view.getUint32(this.pos, this.le);
      this.pos += 4;
      return v;
    }
    f32() {
      const v = this.view.getFloat32(this.pos, this.le);
      this.pos += 4;
      return v;
    }
    take(n) {
      const out = this.bytes.subarray(this.pos, this.pos + n);
      this.pos += n;
      return out;
    }
    str() {
      return new TextDecoder().decode(this.take(this.u16()));
    }
  };
  async function inflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  var RSX_FLOAT_PIVOT_VERSION = 538183465;
  var RSX_LONG_COLOR_VERSION = 538186016;
  async function parseRsx(bytes) {
    const reader = new Reader(bytes, bytes[0] === 4);
    if (reader.str() !== "RE$X") throw new Error("rsx: нет заголовка RE$X");
    const asset = { version: reader.u32(), images: [], frames: [], clips: [], states: [], scale9: /* @__PURE__ */ new Map(), text: /* @__PURE__ */ new Map() };
    const readState = (r, id) => {
      const clip = r.u16();
      r.u16();
      const name2 = r.str();
      const blend = r.u8();
      const colorMode = r.u8();
      r.u16();
      let alpha = 1;
      if (colorMode === 1) alpha = r.f32();
      else if (colorMode === 2) r.u32();
      else if (colorMode === 3) r.take(4 * (asset.version < RSX_LONG_COLOR_VERSION ? 8 : 20));
      let matrix = null;
      if (r.u8() === 33) matrix = [r.f32(), r.f32(), r.f32(), r.f32(), r.f32(), r.f32()];
      asset.states[id] = { clip, name: name2.startsWith("instance") ? "" : name2, blend, alpha, matrix };
    };
    const readExtensions = (r) => {
      const types = {};
      const typeCount = r.u16();
      for (let i = 0; i < typeCount; i++) {
        const key = r.u16();
        types[key] = r.str();
      }
      const count = r.u16();
      for (let i = 0; i < count; i++) {
        const type = types[r.u16()];
        const size = r.u32();
        const end = r.pos + size;
        if (type === "scale9") {
          const n = r.u16();
          for (let j = 0; j < n; j++) {
            const clip = r.u16();
            asset.scale9.set(clip, { x: r.u16(), y: r.u16(), w: r.u16(), h: r.u16() });
          }
        } else if (type === "textfield") {
          const n = r.u16();
          for (let j = 0; j < n; j++) {
            const clip = r.u16();
            const field = r.str();
            const font = r.str();
            const size2 = r.u16() / 100;
            const color = "#" + (r.u32() & 16777215).toString(16).padStart(6, "0");
            const align = r.u8();
            r.u8();
            asset.text.set(clip, { field, font, size: size2, color, align });
          }
        }
        r.pos = end;
      }
    };
    const readChunks = async (r, end) => {
      while (r.pos < end) {
        const type = r.u16();
        const length = r.u32();
        const stop = r.pos + length;
        switch (type) {
          case 2: {
            const raw = await inflate(r.take(length));
            const inner = new Reader(raw, r.le);
            await readChunks(inner, raw.length);
            break;
          }
          case 256: {
            const id = r.u16();
            const kind = r.u8();
            const data2 = new Reader(r.take(length - 3), r.le);
            asset.images[id] = { file: kind === 9 ? data2.str() : "" };
            break;
          }
          case 512:
          case 513: {
            const id = r.u16();
            const image = r.u16();
            const rect = { x: r.i16(), y: r.i16(), w: r.i16(), h: r.i16() };
            const pivotX = asset.version === RSX_FLOAT_PIVOT_VERSION ? Math.trunc(2 * r.f32()) : r.i16();
            const pivotY = asset.version === RSX_FLOAT_PIVOT_VERSION ? Math.trunc(2 * r.f32()) : r.i16();
            const frame = { image, rect, dx: 0, dy: 0, fullW: rect.w, fullH: rect.h, ax: 0, ay: 0 };
            if (type === 513) {
              frame.dx = -r.i16();
              frame.dy = -r.i16();
              frame.fullW = r.i16();
              frame.fullH = r.i16();
            }
            frame.ax = (pivotX + rect.w) / 2 + frame.dx;
            frame.ay = (pivotY + rect.h) / 2 + frame.dy;
            asset.frames[id] = frame;
            break;
          }
          case 768: {
            const id = r.u16();
            const className = r.str();
            r.u8();
            const flags = r.u8();
            const n = r.u16();
            if (flags & 1) r.str();
            if (flags & 2) r.str();
            const frames = [];
            for (let i = 0; i < n; i++) {
              const t = r.u8();
              if (t === 17) frames.push({ piece: r.u16() });
              else if (t === 18 || t === 19) {
                const k = r.u16();
                const states = [];
                for (let j = 0; j < k; j++) states.push(t === 18 ? r.u16() : r.u32());
                frames.push({ states });
              }
            }
            asset.clips[id] = { id, className, frames };
            break;
          }
          case 1024:
            readState(r, r.u16());
            break;
          case 4352:
            readState(r, r.u32());
            break;
          case 4096:
            readExtensions(r);
            break;
          default:
            break;
        }
        r.pos = stop;
      }
    };
    await readChunks(reader, bytes.length - 4);
    return asset;
  }

  // src/gameGui.js
  var GUI_FILES = ["dialog_basic", "button_team_gather_hero_favor"];
  var RENDER_SCALE = 2;
  var MAX_DEPTH = 16;
  var GUI_FPS = 60;
  var BLEND_MODES = [
    "source-over",
    "source-over",
    "source-over",
    "screen",
    "overlay",
    "multiply",
    "lighten",
    "source-over",
    "source-over",
    "hard-light",
    "destination-out",
    "difference",
    "darken",
    "destination-in",
    "lighter"
  ];
  var assets = /* @__PURE__ */ new Map();
  var rendered = /* @__PURE__ */ new Map();
  var fullFrames = /* @__PURE__ */ new Map();
  async function loadGameGui(extra = []) {
    const files = [.../* @__PURE__ */ new Set([...GUI_FILES, ...extra])];
    const loaded = await Promise.all(
      files.map((file) => {
        if (!assets.has(file)) {
          assets.set(file, loadAsset(file).catch((e) => (console.error(e), null)));
        }
        return assets.get(file);
      })
    );
    const list = loaded.filter(Boolean);
    return list.length ? { assets: list } : null;
  }
  async function loadAsset(file) {
    const base = file.includes("/") ? file : `js/gui/${file}`;
    const bytes = await readGameFile(`${base}.rsx`);
    if (!bytes) return null;
    const asset = await parseRsx(bytes);
    asset.file = base.split("/").pop();
    const pattern = new RegExp(`^${base}(\\d+)\\.(png|avif|webp|jpg)$`);
    const sheets = (await listGameFiles(base)).map((path) => pattern.exec(path)).filter(Boolean).sort((a, b) => Number(a[1]) - Number(b[1]));
    asset.sheets = [];
    for (let i = 0; i < asset.images.length; i++) {
      const match = sheets[i];
      const data2 = match ? await readGameFile(match[0]) : null;
      asset.sheets[i] = data2 ? await createImageBitmap(new Blob([data2], { type: `image/${match[2]}` })) : null;
    }
    asset.byName = /* @__PURE__ */ new Map();
    for (const clip of asset.clips) {
      if (clip && clip.frames.length && !asset.byName.has(clip.className)) asset.byName.set(clip.className, clip);
    }
    return asset;
  }
  function findClip(library, name2, prefer) {
    const first = typeof prefer === "string" ? library.assets.find((a) => a.file === prefer) : prefer;
    for (const asset of first ? [first, ...library.assets] : library.assets) {
      const clip = asset.byName.get(name2);
      if (clip) return { asset, clip };
    }
    return null;
  }
  var IDENTITY = [1, 0, 0, 1, 0, 0];
  var mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ];
  function walk(ctx, asset, clip, matrix, alpha, blend, depth) {
    if (!clip || depth > MAX_DEPTH || ctx.exclude?.includes(clip.className)) return;
    const first = clip.frames.length ? clip.frames[ctx.frame % clip.frames.length] : null;
    if (!first) {
      if (/^(text_|marker_)/.test(clip.className)) return;
      const ref = findClip(ctx.library, clip.className, asset);
      if (ref && ref.clip !== clip) walk(ctx, ref.asset, ref.clip, matrix, alpha, blend, depth + 1);
      return;
    }
    if (first.piece !== void 0) {
      const frame = asset.frames[first.piece];
      if (frame && alpha > 0) ctx.visit(asset, frame, asset.scale9.get(clip.id), matrix, alpha, blend);
      return;
    }
    for (const id of first.states ?? []) {
      const state = asset.states[id];
      if (!state || depth === 0 && ctx.pick && !ctx.pick(state.name)) continue;
      const child = state.matrix ? mul(matrix, state.matrix) : matrix;
      walk(ctx, asset, asset.clips[state.clip], child, alpha * state.alpha, state.blend || blend, depth + 1);
    }
  }
  var stretched = (grid, m, scale) => grid && Math.abs(m[1]) + Math.abs(m[2]) < 1e-3 && (Math.abs(m[0] - scale) > 1e-3 || Math.abs(m[3] - scale) > 1e-3);
  function frameBox(frame, m) {
    const xs = [];
    const ys = [];
    const x0 = -frame.ax;
    const y0 = -frame.ay;
    for (const [x, y] of [[x0, y0], [x0 + frame.fullW, y0], [x0, y0 + frame.fullH], [x0 + frame.fullW, y0 + frame.fullH]]) {
      xs.push(m[0] * x + m[2] * y + m[4]);
      ys.push(m[1] * x + m[3] * y + m[5]);
    }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  function fullFrame(asset, frame) {
    const key = `${asset.file}:${asset.frames.indexOf(frame)}`;
    if (!fullFrames.has(key)) {
      const canvas = document.createElement("canvas");
      canvas.width = frame.fullW;
      canvas.height = frame.fullH;
      const sheet = asset.sheets[frame.image];
      if (sheet) {
        const r = frame.rect;
        canvas.getContext("2d").drawImage(sheet, r.x, r.y, r.w, r.h, frame.dx, frame.dy, r.w, r.h);
      }
      fullFrames.set(key, canvas);
    }
    return fullFrames.get(key);
  }
  function drawFrame(g, asset, frame, grid, m, alpha, blend, scale) {
    const sheet = asset.sheets[frame.image];
    if (!sheet) return;
    g.globalAlpha = Math.min(1, alpha);
    g.globalCompositeOperation = BLEND_MODES[blend] ?? "source-over";
    const r = frame.rect;
    if (!stretched(grid, m, scale)) {
      g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      g.drawImage(sheet, r.x, r.y, r.w, r.h, frame.dx - frame.ax, frame.dy - frame.ay, r.w, r.h);
      return;
    }
    const src = fullFrame(asset, frame);
    const W = frame.fullW * m[0];
    const H = frame.fullH * m[3];
    let left = grid.x * scale;
    let right = (frame.fullW - grid.x - grid.w) * scale;
    let top = grid.y * scale;
    let bottom = (frame.fullH - grid.y - grid.h) * scale;
    if (left + right > W) {
      const k = W / (left + right);
      left *= k;
      right *= k;
    }
    if (top + bottom > H) {
      const k = H / (top + bottom);
      top *= k;
      bottom *= k;
    }
    const sx = [0, grid.x, grid.x + grid.w, frame.fullW];
    const sy = [0, grid.y, grid.y + grid.h, frame.fullH];
    const dx = [0, left, W - right, W];
    const dy = [0, top, H - bottom, H];
    g.setTransform(1, 0, 0, 1, m[4] - m[0] * frame.ax - m[2] * frame.ay, m[5] - m[1] * frame.ax - m[3] * frame.ay);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const sw = sx[i + 1] - sx[i];
        const sh = sy[j + 1] - sy[j];
        const dw = dx[i + 1] - dx[i];
        const dh = dy[j + 1] - dy[j];
        if (sw > 0 && sh > 0 && dw > 0 && dh > 0) g.drawImage(src, sx[i], sy[j], sw, sh, dx[i], dy[j], dw, dh);
      }
    }
  }
  function renderFrames(library, name2, frames, opts) {
    const { width = 0, height = 0, scale = 1, only = null, hide = null, exclude = null, file = null, renderScale = RENDER_SCALE, format = "png" } = opts;
    const hit = findClip(library, name2, file);
    if (!hit) return null;
    const pick = only ? (n) => only.includes(n) : hide ? (n) => !hide.includes(n) : null;
    const box2 = [Infinity, Infinity, -Infinity, -Infinity];
    const grow = (asset, frame, grid, m) => {
      const b = frameBox(frame, m);
      box2[0] = Math.min(box2[0], b[0]);
      box2[1] = Math.min(box2[1], b[1]);
      box2[2] = Math.max(box2[2], b[2]);
      box2[3] = Math.max(box2[3], b[3]);
    };
    for (const frame of frames) walk({ library, frame, pick, exclude, visit: grow }, hit.asset, hit.clip, IDENTITY, 1, 0, 0);
    if (!(box2[0] < box2[2] && box2[1] < box2[3])) return null;
    const naturalW = box2[2] - box2[0];
    const naturalH = box2[3] - box2[1];
    const kx = width ? width / naturalW : scale;
    const ky = height ? height / naturalH : scale;
    const W = naturalW * kx;
    const H = naturalH * ky;
    const cellW = Math.max(1, Math.ceil(W * renderScale));
    const cellH = Math.max(1, Math.ceil(H * renderScale));
    const canvas = document.createElement("canvas");
    canvas.width = cellW * frames.length;
    canvas.height = cellH;
    const g = canvas.getContext("2d");
    frames.forEach((frame, index) => {
      const base = [kx * renderScale, 0, 0, ky * renderScale, index * cellW - box2[0] * kx * renderScale, -box2[1] * ky * renderScale];
      const visit = (asset, piece, grid, m, alpha, blend) => drawFrame(g, asset, piece, grid, m, alpha, blend, renderScale);
      walk({ library, frame, pick, exclude, visit }, hit.asset, hit.clip, base, 1, 0, 0);
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    const url = format === "jpeg" ? canvas.toDataURL("image/jpeg", 0.85) : canvas.toDataURL("image/png");
    return { url, width: W, height: H, x: box2[0] * kx, y: box2[1] * ky, count: frames.length };
  }
  function renderGui(library, name2, opts = {}) {
    if (!library) return null;
    const key = JSON.stringify([name2, opts]);
    if (!rendered.has(key)) rendered.set(key, renderFrames(library, name2, [0], opts));
    return rendered.get(key);
  }
  function renderGuiAnimation(library, name2, opts = {}) {
    if (!library) return null;
    const key = JSON.stringify(["anim", name2, opts]);
    if (!rendered.has(key)) {
      const hit = findClip(library, name2, opts.file ?? null);
      const total = opts.frames || hit?.clip.frames.length || 1;
      const every = Math.max(1, opts.every ?? 1);
      const list = [];
      for (let f = 0; f < total; f += every) list.push(f);
      const result = hit ? renderFrames(library, name2, list, opts) : null;
      rendered.set(key, result ? { ...result, duration: total / GUI_FPS } : null);
    }
    return rendered.get(key);
  }

  // src/icons.js
  var iconUrls = /* @__PURE__ */ new Map();
  function toDataUrl(buffer) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(new Blob([buffer], { type: "image/png" }));
    });
  }
  async function loadUnitIcons(ids) {
    const missing = [...new Set(ids.map(Number))].filter((id) => !iconUrls.has(id));
    if (missing.length) {
      const records = await readCacheRecords(missing.map((id) => `hero_icons/${id}.png`));
      for (let i = 0; i < missing.length; i++) {
        const data2 = records[i]?.data;
        iconUrls.set(missing[i], data2 ? await toDataUrl(data2) : await downloadUrlFor(`hero_icons/${missing[i]}.png`));
      }
    }
    return Object.fromEntries(ids.map((id) => [Number(id), iconUrls.get(Number(id)) ?? ""]));
  }
  async function loadFavorSkillIcons(petIds) {
    const out = {};
    for (const raw of petIds) {
      const id = Number(raw);
      const key = `skill:${id}`;
      if (!iconUrls.has(key)) {
        const skillId = lib.data.hero?.[id]?.skill?.[4];
        const texture = skillId ? lib.data.skill?.[skillId]?.icon_assetTexture : "";
        let url = "";
        if (texture) {
          const path = `skill_icons/${texture}.png`;
          const [record] = await readCacheRecords([path]);
          url = record?.data ? await toDataUrl(record.data) : await downloadUrlFor(path);
        }
        iconUrls.set(key, url);
      }
      out[id] = iconUrls.get(key);
    }
    return out;
  }
  var heroAtlas = null;
  async function loadHeroAtlas() {
    const [xml, image] = await readCacheRecords(["hero_icons_only/hero_icons_only.xml", "hero_icons_only/hero_icons_only.avif"]);
    if (!xml?.data || !image?.data) return null;
    const text2 = new TextDecoder().decode(new Uint8Array(xml.data));
    const frames = /* @__PURE__ */ new Map();
    for (const m of text2.matchAll(/<SubTexture name="([^"]+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)) {
      frames.set(m[1], { x: Number(m[2]), y: Number(m[3]), w: Number(m[4]), h: Number(m[5]) });
    }
    const bitmap = await createImageBitmap(new Blob([image.data], { type: "image/avif" }));
    return { bitmap, frames };
  }
  async function loadHeroIcons(ids, size = 112) {
    heroAtlas ??= loadHeroAtlas().catch((e) => {
      console.error(e);
      return null;
    });
    const atlas = await heroAtlas;
    const out = {};
    for (const raw of ids) {
      const id = Number(raw);
      const key = `hero:${id}:${size}`;
      if (!iconUrls.has(key)) {
        const name2 = lib.data.hero?.[id]?.iconAssetTexture ?? String(id).padStart(4, "0");
        const frame = atlas?.frames.get(String(name2));
        let url = "";
        if (frame) {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          canvas.getContext("2d").drawImage(atlas.bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, size, size);
          url = canvas.toDataURL("image/png");
        }
        iconUrls.set(key, url);
      }
      out[id] = iconUrls.get(key);
    }
    return out;
  }

  // src/picker.js
  var PICKER_ID = "nxSquadPicker";
  var PICKER_Z = 10050;
  var STAGE_W = 940;
  var STAGE_H = 680;
  var OX = 140;
  var MAX_SCALE = 1.4;
  var CARD = 96;
  var GRID = { x: 46, y: 104, w: 555, h: 390, step: 110, rowStep: 112, cols: 5, padX: 9, padY: 12 };
  var ROW = { y: 536, petX: 21, heroX: 123, step: 102.5 };
  var ITEM = { w: 421, h: 112, gap: 5, left: 24, top: 67, bottom: 26 };
  var PET_LEVEL = "130";
  var TEXT_COLORS = {
    title: "#fbe0ac",
    tabActive: "#b7f26b",
    tabIdle: "#fbe0ac",
    subHeader: "#fce5b7",
    save: "#e4ff4c",
    cancel: "#fce5b7",
    patronHeader: "#f8dfb2",
    petName: "#ffffff",
    stats: "#ffcf84",
    free: "#f8e8c1",
    busy: "#f2e947",
    chosen: "#e4ff4c"
  };
  var text = (size, color) => `font-family: 'Roboto Condensed', 'Arial Narrow', sans-serif; font-weight: 700; font-size: ${size}px; color: ${color}; text-shadow: 0 1px 1px rgba(0, 0, 0, 0.75), 0 2px 4px rgba(0, 0, 0, 0.5);`;
  var name = (id) => id ? cheats.translate(`LIB_HERO_NAME_${id}`) : "";
  var order = (id) => Number(lib.data.hero?.[id]?.battleOrder ?? 0);
  var statName = (stat) => {
    const key = `LIB_BATTLESTATDATA_${String(stat).toUpperCase()}`;
    const value = cheats.translate(key);
    return value && value !== key ? value : String(stat);
  };
  var BASE_CSS = `
#${PICKER_ID} { position: fixed; inset: 0; z-index: ${PICKER_Z}; background: radial-gradient(ellipse at 50% 35%, #3a2414 0%, #20130b 55%, #0c0704 100%); display: flex; align-items: center; justify-content: center; user-select: none; }
#${PICKER_ID} .nxStage { position: relative; width: ${STAGE_W}px; height: ${STAGE_H}px; flex: none; transform-origin: 0 0; }
#${PICKER_ID} .nxP, #${PICKER_ID} .nxT, #${PICKER_ID} .nxBox, #${PICKER_ID} .nxList { position: absolute; box-sizing: border-box; }
#${PICKER_ID} .nxP { background-size: 100% 100%; background-repeat: no-repeat; }
#${PICKER_ID} .nxT { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
#${PICKER_ID} .nxBox { cursor: pointer; }
#${PICKER_ID} .nxNoHit { pointer-events: none; }
#${PICKER_ID} .nxList { overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; scrollbar-color: #ce9767 transparent; }
#${PICKER_ID} .nxItem .nxHover { opacity: 0; }
#${PICKER_ID} .nxItem:hover .nxHover { opacity: 1; }
#${PICKER_ID} .nxItem:hover .nxIdle { opacity: 0; }
#${PICKER_ID} .nxAnim { background-repeat: no-repeat; animation-name: nxStrip; animation-iteration-count: infinite; }
@keyframes nxStrip { from { background-position-x: 0%; } to { background-position-x: 100%; } }
`;
  var STAR_ANIM = ["epic_star_icon_mid_animated", { frames: 100, every: 2, scale: 0.9, renderScale: 1.5 }];
  var PAW_ANIM = ["icon_pet_favor_bouncing", { every: 2 }];
  var PAW_GLOW_ANIM = ["button_team_gather_hero_favor", { only: ["animation_glow"], exclude: ["icon_pet_favor_bouncing"], frames: 360, every: 6, renderScale: 0.75 }];
  var PICKED_DIM = 0.55;
  async function openHeroListPicker(heroes, title, max = NX_TEAM_SIZE, withRanks = false) {
    return await openSquadPicker("", 0, { heroList: heroes, title, max, withRanks });
  }
  async function openSquadPicker(teamRaw, mainPet, { heroList = null, title = "", max = NX_TEAM_SIZE, withRanks = false } = {}) {
    const listMode = Array.isArray(heroList);
    const limit = listMode ? Math.max(1, Math.min(NX_TEAM_SIZE, max)) : NX_TEAM_SIZE;
    document.getElementById(PICKER_ID)?.remove();
    const petLib = getPetLib();
    const heroes = getEventHeroIds().filter((id) => lib.data.hero?.[id]).sort((a, b) => name(a).localeCompare(name(b)));
    const pets = getEventPetIds().filter((id) => petLib[id]).sort((a, b) => name(a).localeCompare(name(b)));
    const [library, heroIcons, petIcons, skillIcons] = await Promise.all([
      loadGameGui([PET_HEAD_FILE]),
      loadHeroIcons(heroes, 160),
      loadUnitIcons(pets),
      loadFavorSkillIcons(pets)
    ]);
    const team = /* @__PURE__ */ new Map();
    const parsed = !listMode && String(teamRaw ?? "").trim() ? parseArchdemonNewTeam(teamRaw) : { error: true };
    if (listMode) {
      for (const item of heroList) {
        const id = Number(item.id);
        const rank = withRanks ? rankOf(Number(item.rank ?? 1)).rank : RANKS[0].rank;
        if (heroes.includes(id) && team.size < limit) team.set(id, { rank, pet: 0 });
      }
    } else if (!parsed.error) {
      for (const id of parsed.heroes) {
        team.set(id, { rank: rankOf(parsed.targets[id]).rank, pet: Number(parsed.favor[id] ?? 0) });
      }
    }
    let chosenMainPet = listMode ? 0 : Number(mainPet) || 0;
    let tab = "heroes";
    let message = "";
    let patronFor = 0;
    const classes2 = /* @__PURE__ */ new Map();
    let dynamicCss = "";
    const addClass = (key, url) => {
      if (!classes2.has(key)) {
        const cls = `nxC${classes2.size}`;
        classes2.set(key, cls);
        dynamicCss += `#${PICKER_ID} .${cls} { background-image: url("${url}"); }
`;
      }
      return classes2.get(key);
    };
    const art = (symbol, opts = {}) => {
      const r = renderGui(library, symbol, opts);
      return r ? { ...r, cls: addClass(JSON.stringify([symbol, opts]), r.url) } : null;
    };
    const pic = (key, url) => url ? addClass(key, url) : "";
    const animClass = (symbol, opts) => {
      const r = renderGuiAnimation(library, symbol, opts);
      if (!r || r.count < 2) return null;
      const key = JSON.stringify(["anim", symbol, opts]);
      if (!classes2.has(key)) {
        const cls = `nxC${classes2.size}`;
        classes2.set(key, cls);
        dynamicCss += `#${PICKER_ID} .${cls} { background-image: url("${r.url}"); background-size: ${r.count * 100}% 100%; animation-duration: ${r.duration}s; animation-timing-function: steps(${r.count}, jump-none); }
`;
      }
      return { ...r, cls: classes2.get(key) };
    };
    const anim = ([symbol, opts], x, y, { center = false, cls = "", style = "" } = {}) => {
      const a = animClass(symbol, opts);
      if (!a) return "";
      const left = center ? x - a.width / 2 : x + a.x;
      const top = center ? y - a.height : y + a.y;
      const phase = performance.now() / 1e3 % a.duration;
      return `<div class="nxP nxAnim ${a.cls} ${cls}" style="left: ${left}px; top: ${top}px; width: ${a.width}px; height: ${a.height}px; animation-delay: -${phase.toFixed(3)}s; ${style}"></div>`;
    };
    const star = () => anim(STAR_ANIM, CARD / 2, CARD + 6, { center: true, cls: "nxNoHit" }) || piece("epic_star_icon_small", 29, 78, { cls: "nxNoHit" });
    const piece = (symbol, x, y, { render = {}, size = null, fallback = "", inner = "", attrs = "", cls = "", style = "" } = {}) => {
      const a = art(symbol, render);
      if (a) {
        return `<div ${attrs} class="nxP ${a.cls} ${cls}" style="left: ${x + a.x}px; top: ${y + a.y}px; width: ${a.width}px; height: ${a.height}px; ${style}"></div>`;
      }
      if (!fallback || !size) return "";
      return `<div ${attrs} class="nxP ${cls}" style="left: ${x}px; top: ${y}px; width: ${size[0]}px; height: ${size[1]}px; ${fallback} ${style}">${inner}</div>`;
    };
    const label = (value, x, y, w, h, size, color, extra = "") => `<div class="nxT" style="left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px; line-height: ${h}px; text-align: center; ${text(size, color)} ${extra}">${value}</div>`;
    const plate = (symbol, value, fallbackBg, x, y) => piece(symbol, x, y, { size: [40, 28], fallback: `background: ${fallbackBg}; border-radius: 5px; border: 1px solid #000;`, cls: "nxNoHit" }) + label(value, x, y - 1, 40, 28, 20, "#ffffff");
    const check = (x, y) => piece("iconV", x, y, { size: [44, 40], fallback: "color: #5fe02a; font: 700 34px/40px sans-serif; text-align: center;", inner: "✔", cls: "nxNoHit" });
    const heroCard = (id, rank, x, y, { checked = false, attrs = "" } = {}) => {
      const r = RANKS.find((e) => e.rank === rank) ?? RANKS[0];
      const bg = piece(r.gameBg, 8, 8, { render: { width: 80, height: 80 }, cls: "nxNoHit" });
      return `<div ${attrs} class="nxBox" title="${escapeAttr(name(id))}" style="left: ${x}px; top: ${y}px; width: ${CARD}px; height: ${CARD}px;"><div class="nxNoHit" style="position: absolute; inset: 0; ${checked ? `filter: brightness(${PICKED_DIM});` : ""}">` + bg + `<div class="nxP ${pic(`h${id}`, heroIcons[id])}" style="left: 8px; top: 8px; width: 80px; height: 80px; ${bg ? "" : "background-color: #1b1f45;"} border-radius: 4px;"></div>` + piece(r.gameFrame, 0, 0, { size: [CARD, CARD], fallback: `border: 5px solid; border-image: ${r.frame} 1;` }) + star() + plate(r.gamePlate, r.label, r.plate, 28, -10) + "</div>" + (checked ? check(52, 50) : "") + "</div>";
    };
    const petCard = (id, x, y, { checked = false, attrs = "" } = {}) => {
      const bg = piece(PET_GAME_ART.bg, 6, 6, { render: { width: 84, height: 84 }, cls: "nxNoHit", style: `clip-path: ${OCTAGON};` });
      return `<div ${attrs} class="nxBox" title="${escapeAttr(name(id))}" style="left: ${x}px; top: ${y}px; width: ${CARD}px; height: ${CARD}px;"><div class="nxNoHit" style="position: absolute; inset: 0; ${checked ? `filter: brightness(${PICKED_DIM});` : ""}">` + bg + `<div class="nxP ${pic(`p${id}`, petIcons[id])}" style="left: 6px; top: 6px; width: 84px; height: 84px; ${bg ? "" : "background-color: #1b1f45;"} clip-path: ${OCTAGON};"></div>` + piece(PET_GAME_ART.frame, 0, 0, { size: [CARD, CARD], fallback: `background: ${SQUAD_FRAMES.purple}; clip-path: ${OCTAGON}; opacity: 0.35;` }) + star() + plate("level_purple", PET_LEVEL, RANKS[0].plate, 28, -10) + "</div>" + (checked ? check(52, 50) : "") + "</div>";
    };
    const emptySlot = (symbol, x, y, attrs = "", octagon = false) => `<div ${attrs} class="nxBox" style="left: ${x}px; top: ${y}px; width: ${CARD}px; height: ${CARD}px;"><div class="nxP" style="left: 8px; top: 8px; width: 80px; height: 80px; background: #140c07; ${octagon ? `clip-path: ${OCTAGON};` : "border-radius: 4px;"}"></div>` + piece(symbol, 0, 0, { size: [CARD, CARD], fallback: `background: ${SQUAD_FRAMES.empty}; opacity: 0.4; ${octagon ? `clip-path: ${OCTAGON};` : "border-radius: 6px;"}`, style: "opacity: 0.55;" }) + "</div>";
    const pawHtml = () => {
      const paw = anim(PAW_ANIM, 3, 3, { cls: "nxNoHit" });
      if (!paw) {
        return piece("icon_pet_favor_not_set", 2, 2, { render: { width: 36, height: 36 }, size: [36, 36], fallback: "color: #5fe02a; font: 700 26px/36px sans-serif; text-align: center;", inner: "+" });
      }
      return anim(PAW_GLOW_ANIM, 20, 20, { cls: "nxNoHit" }) + paw;
    };
    const patronBadge = (heroId, petId, x, y) => {
      const head = petId ? piece(petHeadSymbol(petId), -1, -3, { render: { file: "pet_icons", width: 42, height: 42 }, cls: "nxNoHit" }) : "";
      const inner = petId ? head || `<div class="nxP ${pic(`p${petId}`, petIcons[petId])}" style="left: 5px; top: 5px; width: 30px; height: 30px; border-radius: 50%; background-color: #1b1f45;"></div>` + piece("item_round_border_purple", 0, 0, { render: { width: 40, height: 40 }, size: [40, 40], fallback: "border: 3px solid #b82bce; border-radius: 50%;" }) : pawHtml();
      return `<div data-patron="${heroId}" class="nxBox" title="${escapeAttr(petId ? name(petId) : I18N("NX_PATRON_ADD"))}" style="left: ${x}px; top: ${y}px; width: 40px; height: 40px; z-index: 3;">${inner}</div>`;
    };
    const tabHtml = (id, value, y) => {
      const active = tab === id;
      const bg = piece("dialog_side_tab", 0, 0, {
        render: { hide: [active ? "bg_up" : "bg_selected"] },
        size: [174, 56],
        fallback: `background: ${active ? "linear-gradient(180deg, #5cc234, #2f7d18)" : "linear-gradient(180deg, #6a4526, #3a2412)"}; clip-path: polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%, 7% 50%);`
      });
      return `<div data-tab="${id}" class="nxBox" style="left: ${OX - 132}px; top: ${y}px; width: 174px; height: 64px;">` + bg + label(value, 21, 14, 132, 36, 18, active ? TEXT_COLORS.tabActive : TEXT_COLORS.tabIdle) + "</div>";
    };
    const sortedTeam = () => [...team.keys()].sort((a, b) => order(a) - order(b));
    const rowTeam = () => sortedTeam().reverse();
    const ownerOf = (petId) => [...team.entries()].find(([, v]) => v.pet === petId)?.[0] ?? 0;
    const gridHtml = () => {
      const ids = tab === "heroes" ? heroes : pets;
      let cells = "";
      ids.forEach((id, index) => {
        const x = GRID.padX + index % GRID.cols * GRID.step;
        const y = GRID.padY + Math.floor(index / GRID.cols) * GRID.rowStep;
        cells += tab === "heroes" ? heroCard(id, RANKS[0].rank, x, y, { checked: team.has(id), attrs: `data-hero-card="${id}"` }) : petCard(id, x, y, { checked: id === chosenMainPet, attrs: `data-pet-card="${id}"` });
      });
      const rows = Math.ceil(ids.length / GRID.cols);
      return label(I18N(tab === "heroes" ? "NX_PICK_HEROES_TITLE" : "NX_PICK_PETS_TITLE"), OX + GRID.x, 68, GRID.w, 30, 20, TEXT_COLORS.subHeader) + `<div class="nxList" style="left: ${OX + GRID.x}px; top: ${GRID.y}px; width: ${GRID.w + 12}px; height: ${GRID.h}px;"><div style="position: relative; height: ${GRID.padY + rows * GRID.rowStep}px;">${cells}</div></div>` + piece("gradientTop", OX + GRID.x, GRID.y - 2, { render: { width: GRID.w }, cls: "nxNoHit", style: "opacity: 0.6;" }) + piece("gradientBot", OX + GRID.x, GRID.y + GRID.h - 56, { render: { width: GRID.w }, cls: "nxNoHit", style: "opacity: 0.6;" });
    };
    const rowHtml = () => {
      let html = listMode ? "" : chosenMainPet ? petCard(chosenMainPet, OX + ROW.petX, ROW.y, { attrs: 'data-remove-mainpet="1"' }) : emptySlot("border_pet_white", OX + ROW.petX, ROW.y, "", true);
      const ids = rowTeam();
      const offset = NX_TEAM_SIZE - ids.length;
      for (let index = 0; index < NX_TEAM_SIZE; index++) {
        const x = OX + ROW.heroX + index * ROW.step;
        const id = index >= offset ? ids[index - offset] : 0;
        if (!id && index < NX_TEAM_SIZE - limit) continue;
        if (!id) {
          html += emptySlot("border_hero_white", x, ROW.y);
          continue;
        }
        const entry = team.get(id);
        html += heroCard(id, entry.rank, x, ROW.y, { attrs: `data-remove-hero="${id}"` });
        if (!listMode) html += patronBadge(id, entry.pet, x + 66, ROW.y - 14);
        if (listMode && !withRanks) continue;
        RANKS.forEach((r, k) => {
          const on = r.rank === entry.rank;
          html += `<div data-rank="${r.rank}" data-rank-hero="${id}" class="nxBox" title="${escapeAttr(I18N(r.key))}" style="left: ${x + 22 + k * 20}px; top: ${ROW.y + CARD + 6}px; width: 14px; height: 14px; border-radius: 50%; background: ${r.dot}; border: 2px solid ${on ? "#ffffff" : "rgba(0, 0, 0, 0.6)"}; box-shadow: ${on ? "0 0 5px #fff" : "none"};"></div>`;
        });
      }
      return html;
    };
    const buttonsHtml = () => piece("startButton_clipLabeled", OX + 652, ROW.y, { size: [143, 58], fallback: "background: linear-gradient(180deg, #5cc234, #2f7d18); border-radius: 8px;", attrs: 'data-save="1"', cls: "nxBox" }) + label(I18N("NX_PICK_SAVE"), OX + 652, ROW.y, 143, 54, 22, TEXT_COLORS.save) + piece("boring_buttonClip_145_58", OX + 651, ROW.y + 66, { size: [145, 58], fallback: "background: linear-gradient(180deg, #8a6a44, #4a3018); border-radius: 8px;", attrs: 'data-close="1"', cls: "nxBox" }) + label(I18N("NX_CANCEL"), OX + 651, ROW.y + 66, 145, 54, 22, TEXT_COLORS.cancel);
    const frameHtml = () => {
      const headerW = 440;
      const headerX = OX + 325 - headerW / 2;
      return (
        /** Тёплое свечение за окном из его раскладки: underBGglow, увеличенный вдвое */
        piece("underBGglow", OX - 6, -84, { render: { scale: 2, renderScale: 0.5 }, cls: "nxNoHit" }) + piece("PopupBG_12_12_12_12", OX + 20, 55, { render: { width: 610, height: 469 }, size: [610, 469], fallback: "background: #1d120b; border-radius: 10px;" }) + piece("mainframeSep_64_64_2_2", OX + 7, 41, { render: { width: 636, height: 491 }, size: [636, 491], fallback: "border: 3px solid #ce9767; border-radius: 12px;", cls: "nxNoHit" }) + piece("header_178_178_2", headerX, 14, { render: { width: headerW }, size: [headerW, 56], fallback: "background: linear-gradient(180deg, #8a5a2a, #4a2a10); border-radius: 10px;", cls: "nxNoHit" }) + label(listMode ? title : I18N("NX_PICK_TITLE"), headerX + 80, 14, headerW - 160, 54, 26, TEXT_COLORS.title) + piece("closeButton_32", OX + 600, 26, { size: [46, 46], fallback: "background: #8a1c12; border: 2px solid #ce9767; border-radius: 50%; color: #fff; font: 700 20px/42px sans-serif; text-align: center;", inner: "✕", attrs: 'data-close="1"', cls: "nxBox" })
      );
    };
    const patronHtml = () => {
      if (!patronFor) return "";
      const heroId = patronFor;
      const own = team.get(heroId)?.pet ?? 0;
      const fitting = pets.filter((petId) => (petLib[petId]?.favorHeroes ?? []).map(Number).includes(heroId));
      const cols = fitting.length >= 4 ? 2 : 1;
      const rows = Math.max(1, Math.ceil(fitting.length / cols));
      const W = ITEM.left * 2 + cols * ITEM.w + (cols - 1) * ITEM.gap;
      const H = ITEM.top + rows * ITEM.h + (rows - 1) * ITEM.gap + ITEM.bottom;
      const ids = rowTeam();
      const slot = NX_TEAM_SIZE - ids.length + Math.max(0, ids.indexOf(heroId));
      const heroCenter = OX + ROW.heroX + slot * ROW.step + CARD / 2;
      const px = Math.round(Math.min(Math.max(heroCenter - W / 2, 8), STAGE_W - W - 8));
      const py = Math.round(ROW.y - 18 - H);
      let items = "";
      fitting.forEach((petId, k) => {
        const ix = ITEM.left + k % cols * (ITEM.w + ITEM.gap);
        const iy = ITEM.top + Math.floor(k / cols) * (ITEM.h + ITEM.gap);
        const owner = ownerOf(petId);
        const stats = (petLib[petId]?.favorStats ?? []).map((s) => escapeAttr(statName(s.stat)));
        let status;
        if (petId === own) {
          status = piece("iconvsmall", 156 - 34, 76, { render: { width: 25, height: 23 }, size: [25, 23], fallback: "color: #5fe02a; font: 700 20px/23px sans-serif;", inner: "✔", cls: "nxNoHit" }) + label(I18N("NX_PATRON_CHOSEN"), 101, 72, 219, 28, 20, TEXT_COLORS.chosen) + piece("clan_member_dismiss_button", 290, 72, { size: [31, 31], fallback: "background: #6a4526; border-radius: 50%;", attrs: `data-patron-remove="1" title="${escapeAttr(I18N("NX_PATRON_REMOVE"))}"`, cls: "nxBox" });
        } else if (owner) {
          status = piece("team_gather_select_favor_label_busy", 95, 70, { cls: "nxNoHit" }) + label(escapeAttr(I18N("NX_PATRON_BUSY", { hero: name(owner) })), 101, 72, 219, 28, 20, TEXT_COLORS.busy);
        } else {
          status = label(I18N("NX_PATRON_FREE"), 101, 72, 219, 28, 20, TEXT_COLORS.free);
        }
        items += `<div data-patron-pick="${petId}" class="nxBox nxItem" style="left: ${ix}px; top: ${iy}px; width: ${ITEM.w}px; height: ${ITEM.h}px;">` + piece("cutePanel_BG_12_12_12_12", 0, 0, { render: { width: ITEM.w, height: ITEM.h }, size: [ITEM.w, ITEM.h], fallback: "background: #2a1a10; border: 1px solid #ce976766; border-radius: 10px;", cls: "nxIdle" }) + piece("cutePanelActive_BG_12_12_12_12", 0, 0, { render: { width: ITEM.w, height: ITEM.h }, size: [ITEM.w, ITEM.h], fallback: "background: #3a2616; border: 1px solid #ce9767; border-radius: 10px;", cls: "nxHover" }) + petCard(petId, 7, 9) + label(escapeAttr(name(petId)), 101, 6, 219, 28, 20, TEXT_COLORS.petName) + `<div class="nxT" style="left: 101px; top: 34px; width: 219px; line-height: 18px; text-align: center; white-space: normal; ${text(16, TEXT_COLORS.stats)}">${stats.join("<br>")}</div>` + status + `<div class="nxP ${pic(`s${petId}`, skillIcons[petId])}" style="left: 333px; top: 21px; width: 72px; height: 72px; background-color: #1b1f45; border-radius: 3px;"></div>` + piece("border_item_purple", 327, 15, { cls: "nxNoHit" }) + "</div>";
      });
      if (!fitting.length) {
        items = label(I18N("NX_PATRON_NONE"), ITEM.left, ITEM.top + 40, ITEM.w, 30, 18, TEXT_COLORS.free);
      }
      const headerW = Math.min(W - 60, 515);
      return `<div data-patron-dim="1" style="position: absolute; inset: 0; z-index: 20; background: rgba(0, 0, 0, 0.45);"><div data-patron-box="1" style="position: absolute; left: ${px}px; top: ${py}px; width: ${W}px; height: ${H}px;">` + piece("titan_tooltip_bg", 0, 0, { render: { width: W, height: H }, size: [W, H], fallback: "background: #221308; border: 3px solid #ce9767; border-radius: 10px;" }) + piece("titan_toolip_pointer", heroCenter - px - 16, H - 7, { cls: "nxNoHit" }) + piece("team_gather_select_favor_header_back", (W - headerW) / 2, 36, { render: { width: headerW }, cls: "nxNoHit" }) + label(I18N("NX_PATRON_TITLE"), 40, 12, W - 80, 36, 24, TEXT_COLORS.patronHeader) + piece("closeButton_32", W - 35, -15, { size: [46, 46], fallback: "background: #8a1c12; border: 2px solid #ce9767; border-radius: 50%; color: #fff; font: 700 20px/42px sans-serif; text-align: center;", inner: "✕", attrs: 'data-patron-close="1"', cls: "nxBox" }) + items + "</div></div>";
    };
    const root = document.createElement("div");
    root.id = PICKER_ID;
    const baseStyle = document.createElement("style");
    baseStyle.textContent = BASE_CSS;
    const artStyle = document.createElement("style");
    const holder = document.createElement("div");
    const stage = document.createElement("div");
    stage.className = "nxStage";
    holder.append(stage);
    root.append(baseStyle, artStyle, holder);
    document.body.append(root);
    const fit = () => {
      const scale = Math.min(MAX_SCALE, (window.innerWidth - 32) / STAGE_W, (window.innerHeight - 32) / STAGE_H);
      stage.style.transform = `scale(${scale})`;
      holder.style.width = `${STAGE_W * scale}px`;
      holder.style.height = `${STAGE_H * scale}px`;
    };
    fit();
    const refresh = () => {
      const scroll = stage.querySelector(".nxList")?.scrollTop ?? 0;
      const html = frameHtml() + tabHtml("heroes", I18N("NX_PICK_TAB_HEROES"), 181) + (listMode ? "" : tabHtml("pets", I18N("NX_PICK_TAB_PETS"), 232)) + gridHtml() + label(message, OX + GRID.x, 496, GRID.w, 26, 16, "#ffb347") + rowHtml() + buttonsHtml() + patronHtml();
      artStyle.textContent = dynamicCss;
      stage.innerHTML = html;
      const list = stage.querySelector(".nxList");
      if (list) list.scrollTop = scroll;
    };
    return await new Promise((resolve) => {
      const finish = (value) => {
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("keyup", onKey, true);
        window.removeEventListener("resize", fit);
        root.remove();
        resolve(value);
      };
      const onKey = (event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        event.preventDefault();
        if (event.type !== "keyup") return;
        if (patronFor) {
          patronFor = 0;
          refresh();
        } else {
          finish(null);
        }
      };
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("keyup", onKey, true);
      window.addEventListener("resize", fit);
      root.addEventListener("click", (event) => {
        const at = (selector) => event.target.closest(selector);
        let el;
        if (patronFor) {
          if (el = at("[data-patron-remove]")) {
            const entry = team.get(patronFor);
            if (entry) entry.pet = 0;
            patronFor = 0;
            refresh();
            return;
          }
          if (el = at("[data-patron-pick]")) {
            const petId = Number(el.dataset.patronPick);
            for (const entry2 of team.values()) {
              if (entry2.pet === petId) entry2.pet = 0;
            }
            const entry = team.get(patronFor);
            if (entry) entry.pet = petId;
            patronFor = 0;
            refresh();
            return;
          }
          if (at("[data-patron-close]") || !at("[data-patron-box]")) {
            patronFor = 0;
            refresh();
          }
          return;
        }
        if (el = at("[data-patron]")) {
          patronFor = Number(el.dataset.patron);
          refresh();
          return;
        }
        if (el = at("[data-rank]")) {
          const entry = team.get(Number(el.dataset.rankHero));
          if (entry) entry.rank = Number(el.dataset.rank);
          refresh();
          return;
        }
        if (el = at("[data-close]")) {
          finish(null);
          return;
        }
        if (el = at("[data-save]")) {
          if (team.size === 0) {
            message = I18N("NX_PICK_NEED");
            refresh();
            return;
          }
          if (listMode) {
            finish({ heroIds: sortedTeam(), ranks: Object.fromEntries(sortedTeam().map((id) => [id, team.get(id).rank])) });
            return;
          }
          const raw = sortedTeam().map((id) => `${id}/${team.get(id).rank}/${team.get(id).pet || "-"}`).join(", ");
          const verdict = parseArchdemonNewTeam(raw);
          if (verdict.error) {
            message = verdict.error;
            refresh();
            return;
          }
          finish({ teamRaw: raw, mainPet: chosenMainPet });
          return;
        }
        if (el = at("[data-tab]")) {
          tab = el.dataset.tab;
          message = "";
          refresh();
          return;
        }
        if (el = at("[data-remove-mainpet]")) {
          chosenMainPet = 0;
          message = "";
          refresh();
          return;
        }
        if (el = at("[data-remove-hero]")) {
          team.delete(Number(el.dataset.removeHero));
          message = "";
          refresh();
          return;
        }
        if (el = at("[data-hero-card]")) {
          const id = Number(el.dataset.heroCard);
          if (team.has(id)) {
            team.delete(id);
            message = "";
          } else if (team.size >= limit && limit === 1) {
            team.clear();
            team.set(id, { rank: RANKS[0].rank, pet: 0 });
            message = "";
          } else if (team.size >= limit) {
            message = I18N("NX_PICK_FULL");
          } else {
            team.set(id, { rank: RANKS[0].rank, pet: 0 });
            message = "";
          }
          refresh();
          return;
        }
        if (el = at("[data-pet-card]")) {
          const id = Number(el.dataset.petCard);
          chosenMainPet = id === chosenMainPet ? 0 : id;
          message = "";
          refresh();
        }
      });
      refresh();
    });
  }

  // src/setup.js
  var SETUP_GUI_FILES = [PET_HEAD_FILE, "talisman_icons"];
  function talismanIconUrl(library, talismanId, size) {
    const icon = lib.data.invasion.talismans?.[talismanId]?.clientData?.icon;
    return icon ? renderGui(library, icon, { file: "talisman_icons", width: size, height: size })?.url ?? "" : "";
  }
  function talismanSlotsHtml(library, talismanIds) {
    return talismanIds.map((id) => {
      const url = id ? talismanIconUrl(library, id, 46) : "";
      return url ? `<img src="${url}" alt="" title="${escapeAttr(cheats.translate(`LIB_TALISMAN_NAME_${id}`))}" style="width: 46px; height: 46px; flex: none;">` : `<div title="${escapeAttr(I18N("NX_ANY_TALISMAN"))}" style="width: 42px; height: 42px; margin: 2px; flex: none; border-radius: 50%; box-sizing: border-box; border: 2px dashed rgba(206, 151, 103, 0.45);"></div>`;
    }).join("");
  }
  async function archdemonNewSetup(chapters, buffAmount, relicLevel) {
    const library = await loadGameGui(SETUP_GUI_FILES);
    const petLib = getPetLib();
    const eventPets = getEventPetIds();
    const savedChapter = Number(getSaveVal(NX_SAVE_KEYS.chapter, 0));
    let currentTeam = String(getSaveVal(NX_SAVE_KEYS.team, ""));
    let currentMainPet = Number(getSaveVal(NX_SAVE_KEYS.mainPet, 0));
    const savedTalismansRaw = getSaveVal(NX_SAVE_KEYS.talismans, [Number(getSaveVal(NX_SAVE_KEYS.talisman, 0))]);
    const savedTalismans = (Array.isArray(savedTalismansRaw) ? savedTalismansRaw : [savedTalismansRaw]).map(Number);
    const rollBosses = getTalismanRollBosses(chapters[0]?.id ?? 0);
    const savedMinCoins = String(getSaveVal(NX_SAVE_KEYS.minCoins, ""));
    let currentCarry = String(getSaveVal(NX_SAVE_KEYS.carry, "40, 16"));
    let currentSacrifice = (parseIdList(String(getSaveVal(NX_SAVE_KEYS.sacrifice, "40"))) ?? []).slice(0, 1).join(", ");
    const savedSacrificeRefreshes = String(getSaveVal(NX_SAVE_KEYS.sacrificeRefreshes, "0"));
    const savedStartRefreshes = String(getSaveVal(NX_SAVE_KEYS.startRefreshes, "0"));
    const savedPauseRaw = getSaveVal(NX_SAVE_KEYS.pause, false);
    const savedPause = savedPauseRaw === true || savedPauseRaw === "true";
    const savedRandomAnyRaw = getSaveVal(NX_SAVE_KEYS.randomAny, false);
    const savedRandomAny = savedRandomAnyRaw === true || savedRandomAnyRaw === "true";
    const talismanRowsFor = (rollNumber) => Object.values(lib.data.invasion.talismans).filter((e) => !NX_EXCLUDED_TALISMAN_IDS.includes(Number(e.id))).filter((e) => rollNumber === 1 || !e.firstChoiceOnly).map((e) => {
      let description = "";
      try {
        const buff = Object.values(lib.data.adventure.buff).find((b) => b.id === e.effectConfig.buffId);
        description = buff ? cheats.translate(`${buff.localeId}_DESC`) : "";
      } catch (err) {
        console.error(err);
      }
      return { id: Number(e.id), name: cheats.translate(`LIB_TALISMAN_NAME_${e.id}`), description, icon: talismanIconUrl(library, e.id, 30) };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const section = (title, hint) => `<div style="text-align: left; margin: 14px 0 4px; font-size: 19px; color: #ffd88a;">${title}` + (hint ? `<div style="font-size: 13px; color: #d8cbb8; opacity: 0.85;">${hint}</div>` : "") + "</div>";
    const radioRow = (group, value, label, checked, title) => `<div class="PopUp_ContCheckbox"><input type="checkbox" class="PopUp_checkbox hwhNewRadio radio_hwhNew_${group}" data-group="${group}" data-value="${escapeAttr(value)}" id="hwhNew_${group}_${escapeAttr(value)}"${checked ? " checked" : ""}><label for="hwhNew_${group}_${escapeAttr(value)}" title="${escapeAttr(title)}">${label}</label></div>`;
    let html = '<div class="PopUp_text" style="text-align: left; max-width: 600px;">';
    const columns = (count, rows, fill = "row") => `<div style="display: grid; grid-template-columns: repeat(${count}, minmax(0, 1fr)); column-gap: 18px; align-items: start;` + (fill === "column" ? ` grid-auto-flow: column; grid-template-rows: repeat(${rows}, auto);` : "") + '">';
    const abyssOrder = getAbyssChapters().map((e) => Number(e.id));
    const chapterAvailable = {};
    const chapterNumbers = {};
    const chapterNeedLevel = {};
    chapters.forEach((chapter) => {
      chapterNeedLevel[chapter.id] = Number(chapter.requirements?.invasionRelic ?? 0);
      chapterAvailable[chapter.id] = buffAmount >= chapterNeedLevel[chapter.id] * 10;
      chapterNumbers[chapter.id] = abyssOrder.indexOf(Number(chapter.id)) + 1;
    });
    const preselected = chapters.find((e) => Number(e.id) === savedChapter && chapterAvailable[e.id]) ?? chapters.find((e) => chapterAvailable[e.id]);
    html += section(I18N("NX_BLOCK_CHAPTER"), "");
    chapters.forEach((chapter) => {
      let label = chapterTitle(chapter, chapterNumbers[chapter.id]) + "&nbsp;&mdash;&nbsp;<span>" + I18N("NX_FREE");
      if (!chapterAvailable[chapter.id]) {
        label += "<br>" + I18N("NX_NEED_RELIC", {
          relicName: getAbyssRelicName(),
          needLevel: chapterNeedLevel[chapter.id],
          haveLevel: relicLevel
        });
      }
      label += "</span>";
      html += radioRow("chapter", chapter.id, label, chapter === preselected, "");
    });
    const initialTalismans = rollBosses.map((bossNumber, index) => {
      const saved = Number(savedTalismans[index] ?? 0);
      return saved !== 0 && !talismanRowsFor(index + 1).some((e) => e.id === saved) ? 0 : saved;
    });
    html += '<div id="nxSquadBlock">' + await squadHtml(section, currentTeam, currentMainPet, initialTalismans) + "</div>";
    html += columns(rollBosses.length);
    rollBosses.forEach((bossNumber, index) => {
      const rollNumber = index + 1;
      const rows = talismanRowsFor(rollNumber);
      const saved = initialTalismans[index];
      html += "<div>";
      html += section(
        I18N("NX_BLOCK_TALISMAN_POINT", { rollNumber, bossNumber }),
        ""
      );
      const group = `talisman${rollNumber}`;
      const iconSpace = (url) => url ? `<img src="${url}" alt="" style="width: 30px; height: 30px; vertical-align: middle; margin: -8px 5px -8px 0;">` : '<span style="display: inline-block; width: 35px;"></span>';
      html += radioRow(group, 0, iconSpace("") + I18N("NX_ANY_TALISMAN"), saved === 0, "");
      rows.forEach((talisman) => {
        html += radioRow(group, talisman.id, iconSpace(talisman.icon) + talisman.name, talisman.id === saved, talisman.description);
      });
      html += "</div>";
    });
    html += "</div>";
    html += '<div id="hwhNewWealthNote" style="text-align: left; margin: 16px 0 0; font-size: 14px; color: #ffd88a;">' + I18N("NX_WEALTH_ONLY_NOTE") + "</div>";
    html += '<div id="hwhNewWealthBlock">';
    html += section(I18N("NX_BLOCK_CARRY"), I18N("NX_BLOCK_CARRY_HINT"));
    html += `<div id="nxCarryBlock">${await heroListHtml(parseRankedIdList(currentCarry) ?? [], "nxCarryEdit", I18N("NX_LIST_EDIT_HINT"))}</div>`;
    html += section(I18N("NX_BLOCK_START_REFRESH"), I18N("NX_BLOCK_START_REFRESH_HINT"));
    html += `<input type="text" id="hwhNewStartRefreshInput" class="PopUp_input" style="width: 100%; box-sizing: border-box;" title="${escapeAttr(I18N("NX_BLOCK_START_REFRESH_HINT"))}" placeholder="0" value="${escapeAttr(savedStartRefreshes)}">`;
    html += section(I18N("NX_BLOCK_SACRIFICE"), I18N("NX_BLOCK_SACRIFICE_HINT"));
    html += `<div id="nxSacrificeBlock">${await heroListHtml(parseRankedIdList(currentSacrifice) ?? [], "nxSacrificeEdit", I18N("NX_SACRIFICE_EDIT_HINT"))}</div>`;
    html += '<div id="nxSacrificeRefreshRow">';
    html += section(I18N("NX_BLOCK_SACRIFICE_REFRESH"), I18N("NX_BLOCK_SACRIFICE_REFRESH_HINT"));
    html += `<input type="text" id="hwhNewSacrificeRefreshInput" class="PopUp_input" style="width: 100%; box-sizing: border-box;" title="${escapeAttr(I18N("NX_BLOCK_SACRIFICE_REFRESH_HINT"))}" placeholder="0" value="${escapeAttr(savedSacrificeRefreshes)}">`;
    html += "</div>";
    html += section(I18N("NX_BLOCK_MIN_COINS", { coin: stallCoinName() }), I18N("NX_BLOCK_MIN_COINS_HINT"));
    html += `<div style="display: flex; align-items: center; gap: 12px;"><input type="text" id="hwhNewMinCoinsInput" class="PopUp_input" style="flex: 1; min-width: 0; box-sizing: border-box;" title="${escapeAttr(I18N("NX_BLOCK_MIN_COINS_HINT"))}" placeholder="${escapeAttr(I18N("NX_MIN_COINS_PLACEHOLDER"))}" value="${escapeAttr(savedMinCoins)}"><span id="nxMinCoinsBonus" style="flex: none; font-size: 14px; color: #ffd88a;">${minCoinsBonusText(savedMinCoins)}</span></div>`;
    html += `<div class="PopUp_ContCheckbox" style="margin-top: 12px;"><input type="checkbox" class="PopUp_checkbox" id="hwhNewRandomAnyInput"${savedRandomAny ? " checked" : ""}><label for="hwhNewRandomAnyInput" title="${escapeAttr(I18N("NX_BLOCK_RANDOM_ANY_HINT", { price: randomLotResale() }))}">${I18N("NX_BLOCK_RANDOM_ANY")}</label></div>`;
    html += `<div class="PopUp_ContCheckbox" style="margin-top: 6px;"><input type="checkbox" class="PopUp_checkbox" id="hwhNewPauseInput"${savedPause ? " checked" : ""}><label for="hwhNewPauseInput" title="${escapeAttr(I18N("NX_BLOCK_PAUSE_HINT"))}">${I18N("NX_BLOCK_PAUSE")}</label></div>`;
    html += "</div>";
    html += '<div id="hwhNewError" style="color: #ff6b6b; text-align: left; margin-top: 12px; min-height: 1px;"></div>';
    html += "</div>";
    const readRadio = (group) => {
      const checked = popup.custom.querySelector(`input[data-group="${group}"]:checked`);
      return checked ? checked.dataset.value : null;
    };
    const syncWealthBlock = () => {
      const block = popup.custom.querySelector("#hwhNewWealthBlock");
      if (!block) return;
      const wealth = Number(readRadio("talisman1")) === NX_WEALTH_TALISMAN_ID;
      block.style.display = wealth ? "" : "none";
      const note = popup.custom.querySelector("#hwhNewWealthNote");
      if (note) {
        note.style.display = wealth ? "none" : "";
      }
    };
    const repaintTalismans = () => {
      const chosen = {};
      popup.custom.querySelectorAll('input.hwhNewRadio[data-group^="talisman"]:checked').forEach((cb) => {
        chosen[cb.dataset.group] = Number(cb.dataset.value);
      });
      popup.custom.querySelectorAll('input.hwhNewRadio[data-group^="talisman"]').forEach((cb) => {
        const value = Number(cb.dataset.value);
        const takenNextDoor = value !== 0 && Object.entries(chosen).some(([group, id]) => group !== cb.dataset.group && id === value);
        const label = cb.nextElementSibling;
        if (label) {
          label.style.opacity = takenNextDoor && !cb.checked ? "0.35" : "";
        }
      });
    };
    const showError = (text2) => {
      const box2 = popup.custom.querySelector("#hwhNewError");
      if (box2) {
        box2.innerHTML = text2;
      }
    };
    const validate = () => {
      const chapterValue = readRadio("chapter");
      if (chapterValue === null) return { error: I18N("NX_ERR_NO_CHAPTER") };
      if (!chapterAvailable[Number(chapterValue)]) {
        return {
          error: I18N("NX_NEED_RELIC", {
            relicName: getAbyssRelicName(),
            needLevel: chapterNeedLevel[Number(chapterValue)] ?? 0,
            haveLevel: relicLevel
          })
        };
      }
      const teamRaw = currentTeam;
      if (!String(teamRaw).trim()) return { error: I18N("NX_ERR_SQUAD_EMPTY") };
      const parsed = parseArchdemonNewTeam(teamRaw);
      if (parsed.error) return { error: parsed.error };
      const mainPetValue = currentMainPet || 0;
      const talismanIds = [];
      for (let rollNumber = 1; rollNumber <= rollBosses.length; rollNumber++) {
        const value = readRadio(`talisman${rollNumber}`);
        if (value === null) return { error: I18N("NX_ERR_TALISMAN") };
        talismanIds.push(Number(value));
      }
      const picked = talismanIds.filter((e) => e !== 0);
      if (new Set(picked).size !== picked.length) return { error: I18N("NX_ERR_TALISMAN_DUP") };
      const talismanId = talismanIds[0];
      const minCoinsRaw = popup.custom.querySelector("#hwhNewMinCoinsInput").value;
      const carryRaw = currentCarry;
      const sacrificeRaw = currentSacrifice;
      const startRefreshesRaw = popup.custom.querySelector("#hwhNewStartRefreshInput").value;
      let minCoins = null;
      let carryHeroes = [];
      let sacrificeHeroes = [];
      let carryTargets = {};
      let sacrificeRefreshes = 0;
      const sacrificeRefreshesRaw = popup.custom.querySelector("#hwhNewSacrificeRefreshInput")?.value ?? "";
      const carryExtraHeroes = [];
      let startRefreshes = 0;
      if (talismanId === NX_WEALTH_TALISMAN_ID) {
        const parsedMinCoins = parseMinCoins(minCoinsRaw);
        if (!parsedMinCoins) return { error: I18N("NX_ERR_MIN_COINS") };
        minCoins = parsedMinCoins.value;
        const carryList = parseRankedIdList(carryRaw);
        if (!carryList || carryList.length > NX_TEAM_SIZE) {
          return { error: I18N("NX_ERR_CARRY") };
        }
        carryHeroes = carryList.map((e) => e.id);
        carryTargets = Object.fromEntries(carryList.map((e) => [e.id, e.rank]));
        sacrificeHeroes = parseIdList(sacrificeRaw);
        if (!sacrificeHeroes || sacrificeHeroes.length !== 1) {
          return { error: I18N("NX_ERR_SACRIFICE") };
        }
        if (!carryHeroes.includes(sacrificeHeroes[0]) && String(sacrificeRefreshesRaw).trim() !== "") {
          const parsedRefreshes = Number(String(sacrificeRefreshesRaw).trim());
          if (!Number.isInteger(parsedRefreshes) || parsedRefreshes < 0 || parsedRefreshes > NX_SACRIFICE_MAX_REFRESHES) {
            return { error: I18N("NX_ERR_SACRIFICE_REFRESH", { max: NX_SACRIFICE_MAX_REFRESHES }) };
          }
          sacrificeRefreshes = parsedRefreshes;
        }
        if (String(startRefreshesRaw).trim() !== "") {
          const parsed2 = Number(String(startRefreshesRaw).trim());
          if (!Number.isInteger(parsed2) || parsed2 < 0 || parsed2 > NX_POINT1_MAX_REFRESHES) {
            return { error: I18N("NX_ERR_START_REFRESH", { max: NX_POINT1_MAX_REFRESHES }) };
          }
          startRefreshes = parsed2;
        }
      }
      const pauseAfterBoss = popup.custom.querySelector("#hwhNewPauseInput")?.checked === true;
      const buyAnyRandomLots = popup.custom.querySelector("#hwhNewRandomAnyInput")?.checked === true;
      const mainPet = Number(mainPetValue);
      const chapterId = Number(chapterValue);
      return {
        value: {
          chapterId,
          chapterNumber: chapterNumbers[chapterId] ?? 0,
          heroes: parsed.heroes,
          targets: parsed.targets,
          favor: parsed.favor,
          favorPets: parsed.favorPets,
          mainPet,
          petsToCollect: [...new Set([...parsed.favorPets, mainPet].filter(Boolean))],
          talismanId,
          talismanIds,
          minCoins,
          carryHeroes,
          carryTargets,
          carryExtraHeroes,
          startRefreshes,
          sacrificeHeroes,
          sacrificeRefreshes,
          pauseAfterBoss,
          buyAnyRandomLots,
          teamRaw: String(teamRaw).trim(),
          minCoinsRaw: String(minCoinsRaw).replace(/\s+/g, ""),
          carryRaw: String(carryRaw).trim(),
          startRefreshesRaw: String(startRefreshesRaw).trim(),
          sacrificeRaw: String(sacrificeRaw).trim(),
          sacrificeRefreshesRaw: String(sacrificeRefreshesRaw).trim()
        }
      };
    };
    return await popup.customPopup(async (complete) => {
      popup.custom.insertAdjacentHTML("beforeend", html);
      popup.setMsgText(
        I18N("NX_SETUP_MESSAGE") + `<span style="position: absolute; left: 14px; top: 2px; font-size: 11px; line-height: 12px; opacity: 0.6;">v${escapeAttr(GM_info.script.version)}</span>`
      );
      popup.custom.querySelectorAll("input.hwhNewRadio").forEach((checkbox) => {
        checkbox.addEventListener("change", function() {
          if (!this.checked) {
            this.checked = true;
            return;
          }
          popup.custom.querySelectorAll(`input.hwhNewRadio[data-group="${this.dataset.group}"]`).forEach((other) => {
            if (other !== this) {
              other.checked = false;
            }
          });
          if (this.dataset.group.startsWith("talisman")) {
            const value = Number(this.dataset.value);
            if (value !== 0) {
              popup.custom.querySelectorAll('input.hwhNewRadio[data-group^="talisman"]:checked').forEach((other) => {
                if (other === this || Number(other.dataset.value) !== value) return;
                other.checked = false;
                const any = popup.custom.querySelector(
                  `input.hwhNewRadio[data-group="${other.dataset.group}"][data-value="0"]`
                );
                if (any) any.checked = true;
              });
            }
            syncWealthBlock();
            repaintTalismans();
            refreshTalismanSlots();
          }
        });
      });
      syncWealthBlock();
      repaintTalismans();
      popup.custom.querySelector("#hwhNewMinCoinsInput")?.addEventListener("input", function() {
        const bonus = popup.custom.querySelector("#nxMinCoinsBonus");
        if (bonus) bonus.innerHTML = minCoinsBonusText(this.value);
      });
      popup.addButton({ msg: I18N("NX_START"), color: "green" }, () => {
        const result = validate();
        if (result.error) {
          showError(result.error);
          return;
        }
        setSaveVal(NX_SAVE_KEYS.chapter, result.value.chapterId);
        setSaveVal(NX_SAVE_KEYS.team, result.value.teamRaw);
        setSaveVal(NX_SAVE_KEYS.mainPet, result.value.mainPet);
        setSaveVal(NX_SAVE_KEYS.talismans, result.value.talismanIds);
        setSaveVal(NX_SAVE_KEYS.minCoins, result.value.minCoinsRaw);
        setSaveVal(NX_SAVE_KEYS.carry, result.value.carryRaw);
        setSaveVal(NX_SAVE_KEYS.sacrifice, result.value.sacrificeRaw);
        setSaveVal(NX_SAVE_KEYS.sacrificeRefreshes, result.value.sacrificeRefreshesRaw);
        setSaveVal(NX_SAVE_KEYS.pause, result.value.pauseAfterBoss);
        setSaveVal(NX_SAVE_KEYS.randomAny, result.value.buyAnyRandomLots);
        setSaveVal(NX_SAVE_KEYS.startRefreshes, result.value.startRefreshesRaw);
        popup.hide();
        complete(result.value);
      });
      function readTalismanIds() {
        return rollBosses.map((bossNumber, index) => Number(readRadio(`talisman${index + 1}`) ?? 0));
      }
      function refreshTalismanSlots() {
        const box2 = popup.custom.querySelector("#nxTalismanSlots");
        if (box2) box2.innerHTML = talismanSlotsHtml(library, readTalismanIds());
      }
      const startButton = popup.buttons[popup.buttons.length - 1];
      const setStartEnabled = (enabled) => {
        if (!startButton) return;
        startButton.style.opacity = enabled ? "" : "0.45";
        startButton.style.pointerEvents = enabled ? "" : "none";
        startButton.title = enabled ? "" : I18N("NX_SQUAD_REQUIRED");
      };
      setStartEnabled(isSquadReady(currentTeam));
      const bindSquadEdit = () => {
        popup.custom.querySelector("#nxSquadEdit")?.addEventListener("click", async () => {
          const picked = await openSquadPicker(currentTeam, currentMainPet);
          if (!picked) return;
          currentTeam = picked.teamRaw;
          currentMainPet = picked.mainPet;
          setSaveVal(NX_SAVE_KEYS.team, currentTeam);
          setSaveVal(NX_SAVE_KEYS.mainPet, currentMainPet);
          const block = popup.custom.querySelector("#nxSquadBlock");
          if (block) {
            block.innerHTML = await squadHtml(section, currentTeam, currentMainPet, readTalismanIds());
          }
          bindSquadEdit();
          setStartEnabled(isSquadReady(currentTeam));
          showError("");
        });
      };
      bindSquadEdit();
      const syncSacrificeRefreshRow = () => {
        const row = popup.custom.querySelector("#nxSacrificeRefreshRow");
        if (!row) return;
        const sacrifice = (parseIdList(currentSacrifice) ?? [])[0];
        row.style.display = sacrifice && !(parseRankedIdList(currentCarry) ?? []).some((e) => e.id === sacrifice) ? "" : "none";
      };
      syncSacrificeRefreshRow();
      const bindListEdit = (buttonId, blockId, title, getRaw, setRaw, saveKey, max, hint, withRanks) => {
        popup.custom.querySelector(`#${buttonId}`)?.addEventListener("click", async () => {
          const picked = await openHeroListPicker(parseRankedIdList(getRaw()) ?? [], title, max, withRanks);
          if (!picked) return;
          setRaw(picked.heroIds.map((id) => withRanks ? `${id}/${picked.ranks[id]}` : id).join(", "));
          setSaveVal(saveKey, getRaw());
          const block = popup.custom.querySelector(`#${blockId}`);
          if (block) block.innerHTML = await heroListHtml(parseRankedIdList(getRaw()) ?? [], buttonId, hint);
          bindListEdit(buttonId, blockId, title, getRaw, setRaw, saveKey, max, hint, withRanks);
          syncSacrificeRefreshRow();
          showError("");
        });
      };
      bindListEdit("nxCarryEdit", "nxCarryBlock", I18N("NX_PICK_CARRY_TITLE"), () => currentCarry, (v) => currentCarry = v, NX_SAVE_KEYS.carry, NX_TEAM_SIZE, I18N("NX_LIST_EDIT_HINT"), true);
      bindListEdit("nxSacrificeEdit", "nxSacrificeBlock", I18N("NX_PICK_SACRIFICE_TITLE"), () => currentSacrifice, (v) => currentSacrifice = v, NX_SAVE_KEYS.sacrifice, 1, I18N("NX_SACRIFICE_EDIT_HINT"), false);
      popup.addButton({ msg: I18N("NX_CANCEL"), color: "red" }, () => {
        popup.hide();
        complete("cancel");
      });
      popup.addButton({ isClose: true }, () => {
        popup.hide();
        complete("cancel");
      });
      popup.show();
    });
  }
  function slotHtml(url, name2, frame, size, border) {
    const inner = url ? `<img src="${url}" alt="" style="width: 100%; height: 100%; display: block; border-radius: 2px; background: #1b1f45; box-shadow: 0 0 0 1px rgba(20, 8, 30, 0.6);">` : '<div style="width: 100%; height: 100%; background: #1b1f45; border-radius: 2px;"></div>';
    return `<div title="${escapeAttr(name2)}" style="position: relative; width: ${size}px; height: ${size}px; padding: ${border}px; box-sizing: border-box; border-radius: 4px; background: ${frame}; box-shadow: 0 0 1px rgba(0, 0, 0, 0.7);">${inner}`;
  }
  function gameSlotHtml(library, url, name2, frameSymbol, size, { octagon = false, round = false, faded = false, bg = "" } = {}) {
    const frame = renderGui(library, frameSymbol, round ? { width: size, height: size } : {});
    if (!frame) return null;
    const k = round ? 1 : size / 96;
    const inset = Math.round(round ? size * 0.14 : (octagon ? 6 : 8) * k);
    const clip = octagon ? `clip-path: ${OCTAGON};` : round ? "border-radius: 50%;" : "border-radius: 3px;";
    const back = bg ? renderGui(library, bg, { width: size - 2 * inset, height: size - 2 * inset }) : null;
    const backHtml = back ? `<img src="${back.url}" alt="" style="position: absolute; left: ${inset}px; top: ${inset}px; width: ${size - 2 * inset}px; height: ${size - 2 * inset}px; ${clip}">` : "";
    const inner = url ? backHtml + `<img src="${url}" alt="" style="position: absolute; left: ${inset}px; top: ${inset}px; width: ${size - 2 * inset}px; height: ${size - 2 * inset}px;${back ? "" : " background: #1b1f45;"} ${clip}">` : `<div style="position: absolute; left: ${inset}px; top: ${inset}px; width: ${size - 2 * inset}px; height: ${size - 2 * inset}px; background: #140c07; ${clip}"></div>`;
    return `<div title="${escapeAttr(name2)}" style="position: relative; width: ${size}px; height: ${size}px; flex: none;">${inner}<img src="${frame.url}" alt="" style="position: absolute; left: ${frame.x * k}px; top: ${frame.y * k}px; width: ${frame.width * k}px; height: ${frame.height * k}px;${faded ? " opacity: 0.55;" : ""}">`;
  }
  async function squadHtml(section, teamRaw, mainPet, talismanIds) {
    const parsed = String(teamRaw ?? "").trim() ? parseArchdemonNewTeam(teamRaw) : { error: true };
    const order2 = (id) => Number(lib.data.hero?.[id]?.battleOrder ?? 0);
    const team = parsed.error ? [] : parsed.heroes.map((id) => ({ id, fragments: parsed.targets[id], pet: Number(parsed.favor[id] ?? 0) })).sort((a, b) => order2(b.id) - order2(a.id));
    const [library, heroIcons, petIcons] = await Promise.all([
      loadGameGui(SETUP_GUI_FILES),
      loadHeroIcons(team.map((e) => e.id)),
      loadUnitIcons([mainPet, ...team.map((e) => e.pet)].filter(Boolean))
    ]);
    const name2 = (id) => id ? cheats.translate(`LIB_HERO_NAME_${id}`) : "";
    const slot = (url, title, gameFrame, cssFrame, size, border, opts) => gameSlotHtml(library, url, title, gameFrame, size, opts) ?? slotHtml(url, title, cssFrame, size, border);
    let row = mainPet ? slot(petIcons[mainPet], name2(mainPet), PET_GAME_ART.frame, SQUAD_FRAMES.purple, 58, 4, { octagon: true, bg: PET_GAME_ART.bg }) : slot("", "", "border_pet_white", SQUAD_FRAMES.empty, 58, 4, { octagon: true, faded: true });
    row = `<div style="margin-right: 6px;">${row}</div></div>`;
    const offset = NX_TEAM_SIZE - team.length;
    for (let index = 0; index < NX_TEAM_SIZE; index++) {
      const hero = index >= offset ? team[index - offset] : null;
      if (!hero) {
        row += slot("", "", "border_hero_white", SQUAD_FRAMES.empty, 58, 4, { faded: true }) + "</div>";
        continue;
      }
      const head = hero.pet ? renderGui(library, petHeadSymbol(hero.pet), { file: "pet_icons", width: 28, height: 28 }) : null;
      const patron = !hero.pet ? "" : head ? `<img src="${head.url}" alt="" title="${escapeAttr(name2(hero.pet))}" style="position: absolute; top: -9px; right: -9px; width: 28px; height: 28px;">` : `<div style="position: absolute; top: -8px; right: -8px;">` + slot(petIcons[hero.pet], name2(hero.pet), "item_round_border_purple", SQUAD_FRAMES.purple, 26, 3, { round: true }) + "</div></div>";
      const rank = rankOf(hero.fragments);
      row += slot(heroIcons[hero.id], name2(hero.id), rank.gameFrame, frameFor(hero.fragments), 58, 4, { bg: rank.gameBg }) + patron + "</div>";
    }
    const button = editButtonHtml("nxSquadEdit", I18N("NX_SQUAD_EDIT_HINT"));
    const talismans = `<div id="nxTalismanSlots" style="display: flex; gap: 4px; margin-left: 10px;">${talismanSlotsHtml(library, talismanIds)}</div>`;
    const ready = team.length > 0;
    const hint = ready ? "" : `<div style="margin-top: 8px; font-size: 14px; color: #ffb347;">${I18N("NX_SQUAD_REQUIRED")}</div>`;
    return section(I18N("NX_BLOCK_SQUAD"), "") + '<div style="display: flex; align-items: center; gap: 8px; padding-top: 8px;">' + row + talismans + button + "</div>" + hint;
  }
  function editButtonHtml(id, hint) {
    return `<div id="${id}" class="PopUp_btnSocket" title="${escapeAttr(hint)}" style="margin-left: auto; flex: none;"><div class="PopUp_btnRow"><div class="PopUp_btnGap green"><div class="PopUp_btnPlate">` + I18N("NX_SQUAD_EDIT") + "</div></div></div></div>";
  }
  async function heroListHtml(items, buttonId, hint) {
    const order2 = (id) => Number(lib.data.hero?.[id]?.battleOrder ?? 0);
    const list = [...items].slice(0, NX_TEAM_SIZE).sort((a, b) => order2(b.id) - order2(a.id));
    const [library, heroIcons] = await Promise.all([loadGameGui(SETUP_GUI_FILES), loadHeroIcons(list.map((e) => e.id))]);
    const name2 = (id) => cheats.translate(`LIB_HERO_NAME_${id}`);
    let row = "";
    for (const item of list.length ? list : [null]) {
      const id = item?.id ?? 0;
      const rank = rankOf(Number(item?.rank ?? 1));
      row += id ? gameSlotHtml(library, heroIcons[id], name2(id), rank.gameFrame, 58, { bg: rank.gameBg }) ?? slotHtml(heroIcons[id], name2(id), rank.frame, 58, 4) : gameSlotHtml(library, "", "", "border_hero_white", 58, { faded: true }) ?? slotHtml("", "", SQUAD_FRAMES.empty, 58, 4);
      row += "</div>";
    }
    return '<div style="display: flex; align-items: center; gap: 8px; padding-top: 4px;">' + row + editButtonHtml(buttonId, hint) + "</div>";
  }
  function stallCoinName() {
    const key = "LIB_COIN_NAME_1080";
    const name2 = cheats.translate(key);
    return name2 && name2 !== key ? name2 : I18N("NX_STALL_COIN");
  }
  function minCoinsBonusText(raw) {
    const value = parseMinCoins(raw)?.value;
    if (value == null) return "";
    return escapeAttr(
      I18N("NX_MIN_COINS_BONUS", { talisman: cheats.translate(`LIB_TALISMAN_NAME_${NX_WEALTH_TALISMAN_ID}`), percent: coinsToPercent(value) })
    );
  }
  function isSquadReady(teamRaw) {
    if (!String(teamRaw ?? "").trim()) return false;
    return !parseArchdemonNewTeam(teamRaw).error;
  }

  // src/start.js
  async function attackArchdemonNew() {
    const missing = missingHelperApi();
    if (missing.length) {
      await popup.confirm(I18N("NX_ERR_HELPER_OLD", { version: helperVersion, list: missing.join(", ") }));
      return returnToMenu();
    }
    const relicId = Object.values(lib.data.invasion.list).find((e) => e.id == sessionState.eventId)?.settings?.relicId;
    const relic = (await Caller.send("workshop_getInfo")).relics.find((e) => e.id == relicId);
    const relicLevel = Number(relic?.level ?? 0);
    const buffAmount = relicLevel <= 1 ? 0 : relicLevel * 10;
    const chapters = getAbyssChapters().filter((e) => getChapterSealCost(e.id) === 0);
    if (chapters.length === 0) {
      await popup.confirm(I18N("NX_ERR_NO_FREE_ABYSS"));
      return returnToMenu();
    }
    const setup = await archdemonNewSetup(chapters, buffAmount, relicLevel);
    if (setup === "cancel" || !setup) {
      return;
    }
    console.log("archdemonNewSetup ", JSON.stringify(setup));
    await runArchdemonNewLoop(setup);
  }

  // src/menu.js
  function addMenuEntry() {
    othersPopupButtons.push({
      get msg() {
        return I18N("NX_MENU_ENTRY");
      },
      get title() {
        return I18N("NX_MENU_TITLE");
      },
      result: async function() {
        try {
          await onClickArchdemonNewButton();
        } catch (e) {
          console.error(e);
          setProgress("", true);
          await popup.confirm(I18N("NX_FAILED"));
        }
      },
      color: "green"
    });
  }
  async function onClickArchdemonNewButton() {
    const info = await Caller.send("invasion_getInfo");
    sessionState.eventId = Number(info?.id ?? 0);
    const opened = Object.values(lib.data.invasion.chapter).some(
      (chapter) => chapter.invasionId === sessionState.eventId && Date.parse(String(chapter.startDate).replace(" ", "T") + "Z") <= Date.now()
    );
    if (!sessionState.eventId || !opened) {
      confShow(I18N("NX_NO_EVENT"));
      return;
    }
    await showArchdemonNewMenu();
  }
  async function showArchdemonNewMenu() {
    const popupButtons = [
      {
        get msg() {
          return I18N("NX_ARCHDEMON");
        },
        get title() {
          return I18N("NX_ARCHDEMON_HINT");
        },
        result: async function() {
          await attackArchdemonNew();
        },
        color: "green"
      },
      {
        get msg() {
          return I18N("NX_ARCHDEMON_AUTO");
        },
        get title() {
          return I18N("NX_ARCHDEMON_AUTO_SOON");
        },
        /** Заглушка: даже если нажать, окно просто закроется */
        result: false,
        color: "green"
      }
    ];
    popupButtons.push({ result: false, isClose: true });
    const answerPromise = popup.confirm(I18N("NX_ARCHDEMON"), popupButtons);
    const autoName = I18N("NX_ARCHDEMON_AUTO");
    for (const button of popup.buttons ?? []) {
      if (button?.textContent?.includes(autoName)) {
        button.style.opacity = "0.45";
        button.style.pointerEvents = "none";
        button.title = I18N("NX_ARCHDEMON_AUTO_SOON");
      }
    }
    const answer = await answerPromise;
    if (typeof answer !== "function") {
      return;
    }
    try {
      await answer();
    } catch (e) {
      console.error(e);
      setProgress("", true);
      await popup.confirm(I18N("NX_FAILED"));
      syncGame();
    }
  }
  function returnToMenu() {
    showArchdemonNewMenu();
  }

  // src/texts.js
  function registerTexts() {
    i18nLangData["en"] = Object.assign(i18nLangData["en"], {
      NX_ARCHDEMON: "ArchRank",
      NX_ARCHDEMON_HINT: "Farm the chapter over and over until the setup is collected, then stop before the Archdemon",
      NX_SETUP_MESSAGE: '<span style="font-size: 25px;">ArchRank</span><br><span style="font-size: 14px;">Check the settings and press Start</span>',
      NX_BLOCK_CHAPTER: "Chapter",
      NX_BLOCK_TEAM: "Heroes, five blocks separated by commas",
      NX_BLOCK_TEAM_HINT: "heroId/rank/petId. Rank: 1 purple, 3 yellow, 7 red. Pet: full 6001 or short 1, dash for none",
      NX_BLOCK_MAIN_PET: "Main pet of the team",
      NX_BLOCK_MAIN_PET_HINT: "It may repeat one of the patrons. If it does not, it will be bought separately",
      NX_BLOCK_MIN_COINS: "{coin}: minimum, inclusive",
      NX_BLOCK_MIN_COINS_HINT: "How many coins must be left before the Archdemon, this number counts. Empty means any. The final shopping stops as soon as the minimum is out of reach",
      NX_TEAM_PLACEHOLDER: "25/1/1, 27/3/2, 29/3/3, 17/1/3, 70/1/-",
      NX_MIN_COINS_PLACEHOLDER: "empty means no condition",
      NX_MIN_COINS_BONUS: "{talisman}: +{percent}% attack",
      NX_STALL_COIN: "Stall coin",
      NX_ANY_TALISMAN: '<span style="color: LimeGreen;">Any talisman</span>',
      NX_PET_NOT_IN_EVENT: "Not in the current event",
      NX_ERR_NO_CHAPTER: "Pick a chapter",
      NX_ERR_BLOCKS: "From one to five blocks are needed, like 25/1/6001, 27/3/6002, ...",
      NX_ERR_BLOCK_FORMAT: 'Block <span style="color: Red;">{block}</span> is malformed. Expected heroId/rank/petId',
      NX_ERR_HERO: "{hero} is not allowed in this event",
      NX_ERR_HERO_DUP: "{hero} is listed twice",
      NX_ERR_RANK: 'Rank in block <span style="color: Red;">{block}</span> must be from 1 to 7',
      NX_ERR_PET: 'No such pet in block <span style="color: Red;">{block}</span>',
      NX_ERR_PET_DUP: "You messed up: {pet} is set as patron for two heroes at once",
      NX_ERR_FAVOR: "{pet} does not patronize {hero}",
      NX_ERR_TALISMAN: "Pick a talisman",
      NX_ERR_MIN_COINS: "Minimum coins is a whole number, or leave it empty",
      NX_ATTEMPT: 'ArchRank — run <span style="color: LimeGreen;">{attempt}</span>',
      NX_SHOPPING: 'Shopping. Coins: <span style="color: LimeGreen;">{coins}</span>, heroes left {heroes}, pets left {pets}',
      NX_MISSION: 'Mission <span style="color: LimeGreen;">{missionNumber}</span>',
      NX_RETRY: "Run {attempt} failed. {reason}<br>Resetting the chapter",
      NX_READY: `<span style="font-size: 25px;">Everything is collected on run <span style="color: LimeGreen;">{attempt}</span></span><br>
          Coins left: <span style="color: LimeGreen;">{coins}</span><br>
          Wealth bonus: <span style="color: LimeGreen;">{percent}</span>%<br>
          Every point before the Archdemon is taken, the talismans are on. Go in and attack the Archdemon yourself`,
      NX_STOPPED: "Stopped on run {attempt}",
      NX_REASON_NOT_COLLECTED: "Not collected: {list}",
      NX_REASON_MIN_COINS: "{coins} coins left (bonus {percent}%), at least {min} needed",
      NX_REASON_MIN_COINS_UNREACHABLE: "Minimum is out of reach: {coins} + sale {resale} + margin {slack} = {projected} < {min}",
      NX_REASON_NO_LIVES: "Lives are over",
      NX_REASON_NO_TALISMAN: "The required talisman was not offered",
      NX_REASON_NO_MISSIONS: "No missions left in the chapter",
      NX_REASON_STOPPED: "Stopped by you",
      NX_COOLDOWN: "Restart in {seconds} s",
      NX_BLOCK_CARRY: "Carry heroes, they only walk you through",
      NX_BLOCK_CARRY_HINT: "On point 1 at least purple is a must, up to the chosen rank they are topped up as soon as possible. Sold after the last point before the Archdemon",
      NX_BLOCK_SACRIFICE: "Who throws the last point",
      NX_BLOCK_SACRIFICE_HINT: "One hero loses the last point before the Archdemon twice on purpose, then the carry team takes it",
      NX_BLOCK_SACRIFICE_REFRESH: "Stall refreshes on the last point to find the throwing hero",
      NX_BLOCK_SACRIFICE_REFRESH_HINT: "Needed when the throwing hero is not a carry hero: then he is bought on the last point. Zero means no refreshes, if he is not there the run restarts",
      NX_ERR_SACRIFICE_REFRESH: "Refreshes for the throwing hero must be a whole number from 0 to {max}",
      NX_SACRIFICE_EDIT_HINT: "Pick one hero",
      NX_SACRIFICE_REFRESH: "Looking for the throwing hero, refresh {refreshes} of {max}",
      NX_ERR_CARRY: "Pick the carry heroes with «Edit»",
      NX_PICK_CARRY_TITLE: "Carry heroes",
      NX_PICK_SACRIFICE_TITLE: "Who throws the point",
      NX_LIST_EDIT_HINT: "Pick up to five heroes and their ranks",
      NX_ERR_SACRIFICE: "Pick one hero to throw the point with «Edit»",
      NX_BLOCK_START_REFRESH: "Spare stall refreshes on point 1",
      NX_BLOCK_START_REFRESH_HINT: "How many refreshes are allowed when the round did not buy enough unknown pairs to earn one. Zero means earned refreshes only",
      NX_ERR_START_REFRESH: "Spare refreshes must be a whole number from 0 to {max}",
      NX_REASON_NO_CARRY_EXTRA: "None of the extra carry heroes were on sale: {list}",
      NX_WEALTH_SHOP: 'Point {point}, stall. Coins: <span style="color: LimeGreen;">{coins}</span>',
      NX_WEALTH_FINAL: "Selling the carry heroes and collecting the real team",
      NX_SACRIFICE: 'Throwing the last point on purpose, <span style="color: LimeGreen;">{number}</span> of {total}',
      NX_REASON_SACRIFICE_WON: "The throwing lineup won, which breaks the plan",
      NX_REASON_NO_CARRY: "Carry heroes were not on sale: {list}",
      NX_REASON_POINT_LOST: "Point {point} was not taken",
      NX_REASON_NO_SACRIFICE: "Nobody to throw the last point with, this hero is not owned: {list}",
      NX_POINT1_REFRESH: 'Point 1, earned refresh <span style="color: LimeGreen;">{refreshes}</span>, unknown lots taken {bought}, coins {coins}',
      NX_BLOCK_PAUSE: "Stop right before the Archdemon",
      NX_BLOCK_PAUSE_HINT: "Shows coins and pinned slots before the final shopping, then lets you continue or stop",
      NX_AFTER_BOSS_REPORT: '<span style="font-size: 22px;">All points before the Archdemon are taken, run {attempt}</span><br>{body}',
      NX_CONTINUE: "Continue",
      NX_HALT: "Stop here",
      NX_HALTED_SYNC: `Stopped before the Archdemon. The chapter is <span style="color: LimeGreen;">not reset</span>.<br>
          The game data will now be synced so the client sees the real state.
          The page is <span style="color: LimeGreen;">not</span> reloaded.<br>
          After that, go in and look at the coins.`,
      NX_BLOCK_TALISMAN_POINT: "Talisman {rollNumber}, before battle {bossNumber}",
      NX_ERR_TALISMAN_DUP: "The same talisman cannot be taken on both points: the worn one is not offered again",
      NX_ERR_NO_FREE_ABYSS: "This event has no free Abyss chapter",
      NX_ERR_PAID_CHAPTER: "Entering this chapter now costs Abyss Seals. The run is stopped, nothing is spent",
      NX_ERR_HELPER_OLD: "HeroWarsHelper {version} is too old for the add-on, missing: {list}. Update the helper: the add-on works with 2.459 and newer",
      NX_ERR_RESULT_INVALID: "The game server did not accept a battle result and counted an auto-battle instead. The run is stopped",
      NX_WEALTH_ONLY_NOTE: "Wealth strategy settings appear when the Talisman of Wealth is picked for point 1",
      NX_BLOCK_RANDOM_ANY: "Buy unknown cards at any price",
      NX_BLOCK_RANDOM_ANY_HINT: "Unchecked: only when cheaper than {price}, then resale pays them back. Checked: always, in case needed heroes are inside",
      NX_LOG_STOP: "Stop",
      NX_LOG_STOPPING: "Stopping…",
      NX_LOG_LAST_FAIL: "Last failed run {attempt}: {reason}",
      NX_TIMER_SEARCH: "Picking the battle timer {count} of {max}",
      NX_LOSS_SEARCH: "Looking for a losing battle to throw the point, {count} of {max}",
      NX_LOSS_FOUND_WAIT: "Losing battle found, sending it in {seconds} s",
      NX_LOSS_SENT: "Losing battle sent",
      NX_LOSS_NOT_FOUND: "No losing battle found, the plain auto battle goes",
      NX_BLOCK_SQUAD: "Goal: collect this team",
      NX_SQUAD_EDIT: "Edit",
      NX_SQUAD_EDIT_HINT: "Pick the heroes, their ranks and patrons, and the main pet",
      NX_PICK_TITLE: "Build the goal team",
      NX_PICK_TAB_HEROES: "Heroes",
      NX_PICK_TAB_PETS: "Pet",
      NX_PICK_HEROES_TITLE: "Pick heroes",
      NX_PICK_PETS_TITLE: "Pick the main pet",
      NX_PICK_SAVE: "Save",
      NX_PICK_NEED: "At least one hero is needed",
      NX_PICK_FULL: "Five heroes are already picked. Remove one first",
      NX_RANK_PURPLE: "Purple, 80",
      NX_RANK_YELLOW: "Yellow, 100",
      NX_RANK_RED: "Red, 130",
      NX_PATRON_TITLE: "Pick a patron pet",
      NX_PATRON_ADD: "Pick a patron",
      NX_PATRON_CHOSEN: "Chosen",
      NX_PATRON_FREE: "Free",
      NX_PATRON_BUSY: "Taken: {hero}",
      NX_PATRON_REMOVE: "Remove",
      NX_PATRON_NONE: "No pet in this event patronizes this hero",
      NX_ERR_SQUAD_EMPTY: "The team is not set yet",
      NX_START: "Start",
      NX_SQUAD_REQUIRED: "First pick the goal team with «Edit»",
      NX_MENU_ENTRY: "Adventure (Arch)",
      NX_MENU_TITLE: "Abyss run up to the Archdemon",
      NX_ARCHDEMON_AUTO: "ArchRank(auto)",
      NX_ARCHDEMON_AUTO_SOON: "Coming later: the full run with battle emulation to pick the best teams",
      NX_NO_EVENT: "No Adventure is running right now",
      NX_FAILED: "The run broke down. Details are in the console",
      NX_TALISMAN_TAKEN: "Talisman on: {name}",
      NX_CHAPTER: "Chapter",
      NX_NEXT: "Next",
      NX_CANCEL: "Cancel",
      NX_ENTERING: "Entering the chapter",
      NX_FREE: '<span style="color: LimeGreen;">free</span>',
      NX_NEED_RELIC: '<span style="color: #ff6b6b;">{relicName} level {needLevel} is needed, yours is {haveLevel}</span>'
    });
    i18nLangData["ru"] = Object.assign(i18nLangData["ru"], {
      NX_ARCHDEMON: "ArchRank",
      NX_ARCHDEMON_HINT: "Крутить главу по кругу, пока не соберётся связка, и остановиться перед Архидемоном",
      NX_SETUP_MESSAGE: '<span style="font-size: 25px;">ArchRank</span><br><span style="font-size: 14px;">Проверьте настройки и нажмите Начать</span>',
      NX_BLOCK_CHAPTER: "Глава",
      NX_BLOCK_TEAM: "Герои, пять блоков через запятую",
      NX_BLOCK_TEAM_HINT: "IdГероя/ранг/IdПитомца. Ранг: 1 фиолетовый, 3 жёлтый, 7 красный. Питомец: полный 6001 или короткий 1, прочерк если не нужен",
      NX_BLOCK_MAIN_PET: "Основной питомец команды",
      NX_BLOCK_MAIN_PET_HINT: "Может совпадать с одним из покровителей. Если не совпадает, его придётся докупать отдельно",
      NX_BLOCK_MIN_COINS: "{coin}: минимум, включительно",
      NX_BLOCK_MIN_COINS_HINT: "Сколько монет должно остаться перед Архидемоном, само число подходит. Пусто значит любой остаток. Финальная закупка прекращается, как только минимум не достижим",
      NX_TEAM_PLACEHOLDER: "25/1/1, 27/3/2, 29/3/3, 17/1/3, 70/1/-",
      NX_MIN_COINS_PLACEHOLDER: "пусто — без условия",
      NX_MIN_COINS_BONUS: "{talisman}: +{percent}% к атаке",
      NX_STALL_COIN: "Монета лавки",
      NX_ANY_TALISMAN: '<span style="color: LimeGreen;">Любой талисман</span>',
      NX_PET_NOT_IN_EVENT: "Не участвует в текущем событии",
      NX_ERR_NO_CHAPTER: "Выберите главу",
      NX_ERR_BLOCKS: "Нужно от одного до пяти блоков вида 25/1/6001, 27/3/6002, ...",
      NX_ERR_BLOCK_FORMAT: 'Блок <span style="color: Red;">{block}</span> кривой. Ожидается IdГероя/ранг/IdПитомца',
      NX_ERR_HERO: "{hero} не допущен к событию",
      NX_ERR_HERO_DUP: "{hero} указан дважды",
      NX_ERR_RANK: 'Ранг в блоке <span style="color: Red;">{block}</span> должен быть от 1 до 7',
      NX_ERR_PET: 'Нет такого питомца в блоке <span style="color: Red;">{block}</span>',
      NX_ERR_PET_DUP: "Налажали: {pet} поставлен покровителем сразу двум героям",
      NX_ERR_FAVOR: "{pet} не покровительствует герою {hero}",
      NX_ERR_TALISMAN: "Выберите талисман",
      NX_ERR_MIN_COINS: "Минимум монет — целое число или пусто",
      NX_ATTEMPT: 'ArchRank — заход <span style="color: LimeGreen;">{attempt}</span>',
      NX_SHOPPING: 'Закупка. Монет: <span style="color: LimeGreen;">{coins}</span>, героев осталось {heroes}, питомцев {pets}',
      NX_MISSION: 'Миссия <span style="color: LimeGreen;">{missionNumber}</span>',
      NX_RETRY: "Заход {attempt} не сложился. {reason}<br>Сбрасываем главу",
      NX_READY: `<span style="font-size: 25px;">Всё собрано на заходе <span style="color: LimeGreen;">{attempt}</span></span><br>
          Осталось монет: <span style="color: LimeGreen;">{coins}</span><br>
          Бонус богатства: <span style="color: LimeGreen;">{percent}</span>%<br>
          Все точки до Архидемона взяты, талисманы надеты. Зайдите и атакуйте Архидемона сами`,
      NX_STOPPED: "Остановлено на заходе {attempt}",
      NX_REASON_NOT_COLLECTED: "Не собрано: {list}",
      NX_REASON_MIN_COINS: "Осталось {coins} монет (бонус {percent}%), нужно не меньше {min}",
      NX_REASON_MIN_COINS_UNREACHABLE: "До минимума не дотянуть: {coins} + продажа {resale} + запас {slack} = {projected} < {min}",
      NX_REASON_NO_LIVES: "Закончились жизни",
      NX_REASON_NO_TALISMAN: "Нужный талисман не выпал",
      NX_REASON_NO_MISSIONS: "В главе не осталось миссий",
      NX_REASON_STOPPED: "Остановлено вами",
      NX_COOLDOWN: "Перезапуск через {seconds} с",
      NX_BLOCK_CARRY: "Проходные герои, ими только идём",
      NX_BLOCK_CARRY_HINT: "На первой точке обязательно хотя бы до фиолетового, до выбранного ранга докупаются при первой возможности. Продаются после последней точки перед Архидемоном",
      NX_BLOCK_SACRIFICE: "Кем сливаем последнюю точку",
      NX_BLOCK_SACRIFICE_HINT: "Один герой дважды намеренно проигрывает последнюю точку перед Архидемоном, потом её берёт проходной состав",
      NX_BLOCK_SACRIFICE_REFRESH: "Обновлений лавки на последней точке, чтобы найти героя для слива",
      NX_BLOCK_SACRIFICE_REFRESH_HINT: "Нужно, если героя для слива нет среди проходных: тогда его докупают на последней точке. Ноль — без обновлений, не нашёлся — заход заново",
      NX_ERR_SACRIFICE_REFRESH: "Обновлений для героя слива — целое число от 0 до {max}",
      NX_SACRIFICE_EDIT_HINT: "Выбрать одного героя",
      NX_SACRIFICE_REFRESH: "Ищем героя для слива, обновление {refreshes} из {max}",
      NX_ERR_CARRY: "Выберите проходных героев кнопкой «Изменить»",
      NX_PICK_CARRY_TITLE: "Проходные герои",
      NX_PICK_SACRIFICE_TITLE: "Кем сливаем точку",
      NX_LIST_EDIT_HINT: "Выбрать до пяти героев и их ранги",
      NX_ERR_SACRIFICE: "Выберите одного героя для слива кнопкой «Изменить»",
      NX_BLOCK_START_REFRESH: "Запас обновлений лавки на первой точке",
      NX_BLOCK_START_REFRESH_HINT: "Сколько раз можно обновить, если за круг не набралось нужного числа неизвестных пар. Ноль значит только заработанные",
      NX_ERR_START_REFRESH: "Запас обновлений это целое число от 0 до {max}",
      NX_REASON_NO_CARRY_EXTRA: "Ни одного дополнительного проходного не было в продаже: {list}",
      NX_WEALTH_SHOP: 'Точка {point}, лавка. Монет: <span style="color: LimeGreen;">{coins}</span>',
      NX_WEALTH_FINAL: "Продаём проходных и собираем основной состав",
      NX_SACRIFICE: 'Намеренно сливаем последнюю точку, <span style="color: LimeGreen;">{number}</span> из {total}',
      NX_REASON_SACRIFICE_WON: "Сливающий состав выиграл, это ломает план",
      NX_REASON_NO_CARRY: "Проходных не было в продаже: {list}",
      NX_REASON_POINT_LOST: "Точка {point} не взята",
      NX_REASON_NO_SACRIFICE: "Нечем сливать последнюю точку, этого героя нет в наличии: {list}",
      NX_POINT1_REFRESH: 'Точка 1, заработанное обновление <span style="color: LimeGreen;">{refreshes}</span>, неизвестных взято {bought}, монет {coins}',
      NX_BLOCK_PAUSE: "Остановиться прямо перед Архидемоном",
      NX_BLOCK_PAUSE_HINT: "Покажет монеты и закреплённые слоты до финальной закупки, дальше можно продолжить или остановиться",
      NX_AFTER_BOSS_REPORT: '<span style="font-size: 22px;">Все точки до Архидемона взяты, заход {attempt}</span><br>{body}',
      NX_CONTINUE: "Продолжить",
      NX_HALT: "Остановиться",
      NX_HALTED_SYNC: `Остановились перед Архидемоном. Глава <span style="color: LimeGreen;">не сброшена</span>.<br>
          Сейчас данные игры синхронизируются, чтобы клиент увидел настоящее состояние.
          Страница при этом <span style="color: LimeGreen;">не</span> перезагружается.<br>
          После этого зайдите и посмотрите монеты.`,
      NX_BLOCK_TALISMAN_POINT: "Талисман {rollNumber}, перед боем {bossNumber}",
      NX_ERR_TALISMAN_DUP: "Один и тот же талисман на обе точки не взять: надетый второй раз не предлагают",
      NX_ERR_NO_FREE_ABYSS: "В этом событии нет бесплатной главы Бездны",
      NX_ERR_PAID_CHAPTER: "Вход в эту главу теперь стоит Печатей Бездны. Прогон остановлен, ничего не потрачено",
      NX_ERR_HELPER_OLD: "HeroWarsHelper {version} слишком старый для дополнения, нет: {list}. Обновите помощника: дополнение работает с 2.459 и новее",
      NX_ERR_RESULT_INVALID: "Сервер игры не принял результат боя и засчитал автобой. Прогон остановлен",
      NX_WEALTH_ONLY_NOTE: "Настройки стратегии богатства появятся, если на первой точке выбрать Талисман богатства",
      NX_BLOCK_RANDOM_ANY: "Скупать неизвестные карты по любой цене",
      NX_BLOCK_RANDOM_ANY_HINT: "Без галки: только дешевле {price}, тогда их окупает продажа. С галкой: всегда, вдруг там нужные герои",
      NX_LOG_STOP: "Стоп",
      NX_LOG_STOPPING: "Останавливаем…",
      NX_LOG_LAST_FAIL: "Прошлый неудачный заход {attempt}: {reason}",
      NX_TIMER_SEARCH: "Подбор таймера боя {count} из {max}",
      NX_LOSS_SEARCH: "Ищем проигрыш для слива {count} из {max}",
      NX_LOSS_FOUND_WAIT: "Комбинация проигрыша найдена, отправим через {seconds} с",
      NX_LOSS_SENT: "Проигрыш отправлен",
      NX_LOSS_NOT_FOUND: "Проигрыш не найден, уходит обычный автобой",
      NX_BLOCK_SQUAD: "Цель — собрать этот состав",
      NX_SQUAD_EDIT: "Изменить",
      NX_SQUAD_EDIT_HINT: "Выбрать героев, их ранги и покровителей, основного питомца",
      NX_PICK_TITLE: "Собери целевой состав",
      NX_PICK_TAB_HEROES: "Герои",
      NX_PICK_TAB_PETS: "Питомец",
      NX_PICK_HEROES_TITLE: "Выбери героев",
      NX_PICK_PETS_TITLE: "Выбери основного питомца",
      NX_PICK_SAVE: "Сохранить",
      NX_PICK_NEED: "Нужен хотя бы один герой",
      NX_PICK_FULL: "Уже выбрано пять героев. Сначала уберите одного",
      NX_RANK_PURPLE: "Фиолетовый, 80",
      NX_RANK_YELLOW: "Жёлтый, 100",
      NX_RANK_RED: "Красный, 130",
      NX_PATRON_TITLE: "Выбери питомца-покровителя",
      NX_PATRON_ADD: "Выбрать покровителя",
      NX_PATRON_CHOSEN: "Выбран",
      NX_PATRON_FREE: "Свободен",
      NX_PATRON_BUSY: "Занят: {hero}",
      NX_PATRON_REMOVE: "Убрать",
      NX_PATRON_NONE: "В событии нет питомцев, которые покровительствуют этому герою",
      NX_ERR_SQUAD_EMPTY: "Состав ещё не задан",
      NX_START: "Начать",
      NX_SQUAD_REQUIRED: "Сначала выберите целевой состав кнопкой «Изменить»",
      NX_MENU_ENTRY: "Приключение (Arch)",
      NX_MENU_TITLE: "Прогон Бездны до Архидемона",
      NX_ARCHDEMON_AUTO: "ArchRank(auto)",
      NX_ARCHDEMON_AUTO_SOON: "Появится позже: полный прогон с эмуляцией боёв для подбора лучших команд",
      NX_NO_EVENT: "Сейчас Приключение не идёт",
      NX_FAILED: "Прогон сорвался. Подробности в консоли",
      NX_TALISMAN_TAKEN: "Надели талисман: {name}",
      NX_CHAPTER: "Глава",
      NX_NEXT: "Дальше",
      NX_CANCEL: "Отмена",
      NX_ENTERING: "Входим в главу",
      NX_FREE: '<span style="color: LimeGreen;">бесплатно</span>',
      NX_NEED_RELIC: '<span style="color: #ff6b6b;">нужен {relicName} {needLevel} уровня, у вас {haveLevel}</span>'
    });
  }

  // src/main.js
  if (!hwhFound) {
    console.log("%cHWHArchdemonExt: HeroWarsHelper не найден, дополнение не запущено", "color: red");
  } else {
    const missing = missingHelperApi();
    if (missing.length) console.log(`%cHWHArchdemonExt: HeroWarsHelper ${helperVersion} слишком старый, нет: ${missing.join(", ")}`, "color: red");
    addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);
    registerTexts();
    addMenuEntry();
  }
})();

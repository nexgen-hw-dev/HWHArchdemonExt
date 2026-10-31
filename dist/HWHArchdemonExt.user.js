// ==UserScript==
// @name            HWHArchdemonExt
// @name:en         HWHArchdemonExt
// @name:ru         HWHArchdemonExt
// @namespace       HWHArchdemonExt
// @version         1.07-beta
// @author          NexGen
// @description     Archdemon add-on for HeroWarsHelper: runs the free Abyss chapter until the setup is collected and stops before the Archdemon
// @description:en  Archdemon add-on for HeroWarsHelper: runs the free Abyss chapter until the setup is collected and stops before the Archdemon
// @description:ru  Дополнение к HeroWarsHelper: крутит бесплатную главу Бездны, пока не соберётся связка, и останавливается перед Архидемоном
// @license         Copyright NexGen
// @match           https://www.hero-wars.com/*
// @match           https://www.hero-wars.cn/*
// @match           https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at          document-start
// ==/UserScript==

(function() {
	"use strict";
	var NX_SALE_TALISMAN_ID = 8009;
	var NX_PET_ID_THRESHOLD = 4400;
	var NX_TIMER_SEARCH_MAX_TRIES = 1e3;
	var NX_TIMER_SEARCH_GRID = 30;
	var NX_TIMER_SEARCH_BUDGET_MS = 6e4;
	var NX_LOSS_TIMER_RANGE = {
		min: 1.3,
		max: 25
	};
	var NX_LOSS_TIMER_STEP = .5;
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
		randomAny: "savedBuyAnyRandomLotsForArchdemonNew",
		stopIncomplete: "savedStopIfIncompleteForArchdemonNew",
		sacrificePoint: "savedSacrificePointForArchdemonNew",
		keepExtraCoins: "savedKeepExtraCoinsForArchdemonNew",
		logPosition: "savedRunLogPositionForArchdemonNew",
		logCollapsed: "savedRunLogCollapsedForArchdemonNew"
	};
	var NX_HELPER_POLL_MS = 200;
	var NX_HELPER_WAIT_MS = 6e4;
	var NX_OLD_HELPER_NOTICE_MS = 5e3;
	var NX_PRELOAD_POLL_MS = 2e3;
	var NX_PRELOAD_WAIT_MS = 6e5;
	var NX_PRELOAD_SETTLE_MS = 5e3;
	var NX_PRELOAD_IDLE_MS = 100;
	var NX_EVENT_END_MARGIN_MINUTES = 10;
	var NX_PRESETS_URLS = [
		"https://hwh-archdemon.netlify.app/api/v1/presets",
		"https://cdn.jsdelivr.net/gh/nexgen-hw-dev/hwh-presets-api@main/data/presets.json",
		"https://raw.githubusercontent.com/nexgen-hw-dev/hwh-presets-api/main/data/presets.json"
	];
	var NX_PRESETS_MIRROR_KEY = "HWHArchdemonExt.presets.mirror";
	var NX_PRESETS_STORAGE_KEY = "HWHArchdemonExt.presets.v1";
	var NX_PRESETS_TTL_MS = 72e5;
	var NX_UPDATE_URLS = ["https://raw.githubusercontent.com/nexgen-hw-dev/HWHArchdemonExt/main/dist/HWHArchdemonExt.user.js", "https://cdn.jsdelivr.net/gh/nexgen-hw-dev/HWHArchdemonExt@main/dist/HWHArchdemonExt.user.js"];
	var NX_UPDATE_TTL_MS = 216e5;
	var NX_UPDATE_RETRY_MS = 36e5;
	var NX_UPDATE_STORAGE_KEY = "HWHArchdemonExt.update.v1";
	var NX_GREASYFORK_URL = "https://greasyfork.org/scripts/597541";
	var NX_PRESETS_TIMEOUT_MS = 5e3;
	var NX_PRESETS_FORCE_KEY = "HWHArchdemonExt.presets.forcedAt";
	var NX_PRESETS_FORCE_INTERVAL_MS = 6e4;
	var NX_PRESET_VIDEO = { 1: {
		prefix: "https://www.youtube.com/watch?v=",
		id: /^[\w-]{11}$/
	} };
	var NX_PRESET_SITES = [{
		name: "HWDaily",
		url: "https://hwdaily.win/eva-event/archdemon",
		author: "Fragator",
		key: "NX_PRESETS_SITE_HWDAILY"
	}, {
		name: "HWMAP",
		url: "https://hwmap.online/invasion/2999000034/teams",
		author: "Kircheis",
		key: "NX_PRESETS_SITE_HWMAP"
	}];
	var NX_PRESETS_WAIT_LINKS = {
		telegram: {
			en: [{
				name: "HeroWarsUserScript",
				url: "https://t.me/HeroWarsUserScript",
				key: "NX_PRESETS_TG_HELPER"
			}],
			ru: [{
				name: "HeroWarsUserScripts",
				url: "https://t.me/HeroWarsUserScripts",
				key: "NX_PRESETS_TG_HELPER"
			}, {
				name: "HW_Goodwin",
				url: "https://t.me/HW_Goodwin",
				key: "NX_PRESETS_TG_GOODWIN"
			}]
		},
		youtube: [
			{
				name: "Ganji",
				url: "https://www.youtube.com/@ganji_HW"
			},
			{
				name: "TRADE BOY",
				url: "https://www.youtube.com/@tradeboy1K"
			},
			{
				name: "Deda Hero Wars",
				url: "https://www.youtube.com/@dedaherowars"
			},
			{
				name: "Задонать и Победи",
				url: "https://www.youtube.com/@ChaosTema"
			}
		],
		sites: [{
			name: "HWDaily",
			url: "https://hwdaily.win/",
			key: "NX_PRESETS_SITE_HWDAILY"
		}, {
			name: "HWMAP",
			url: "https://hwmap.online/",
			key: "NX_PRESETS_SITE_HWMAP"
		}]
	};
	var NX_PRESET_CARRY = [46, 72];
	var NX_PRESET_SACRIFICE = 46;
	var NX_PRESET_STRONG_BUFF = 200;
	var NX_PRESET_STRONG_CARRY = [72];
	var NX_PRESET_STRONG_SACRIFICE = 72;
	var NX_PRESET_SACRIFICE_POINT = 5;
	var NX_SACRIFICE_POINTS = [5, 7];
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
	var NX_SACRIFICE_CANDIDATES = 5;
	var NX_SACRIFICE_ROLES = ["support", "melee_tank"];
	var NX_SACRIFICE_MAX_REFRESHES = 30;
	var NX_LOTS_PER_EARNED_REFRESH = 2;
	var NX_POINT1_MAX_REFRESHES = 30;
	var NX_CARRY_UNSEEN_LIMIT = 60;
	var NX_RANDOM_LOT_FRAGMENTS = 2;
	var NX_BATTLE_TIMER_RANGE = {
		min: 1.3,
		max: 25
	};
	var NX_LOG_CASH = `КАССА[${GM_info.script.version}]`;
	var NX_LOG_BATTLE = `БОЙ[${GM_info.script.version}]`;
	var NX_OLD_HELPER_TEXT = "HWHArchdemonExt: HeroWarsHelper устарел, обновите его / HeroWarsHelper is outdated, please update it";
	var NX_TEXTS = {
		en: {
			NX_LANG: "en",
			NX_SETUP_MESSAGE: "<span style=\"font-size: 25px;\">ArchRank</span><br><span style=\"font-size: 14px;\">Check the settings and press Start</span>",
			NX_BLOCK_CHAPTER: "Chapter",
			NX_BLOCK_MIN_COINS: "{coin}: minimum, inclusive",
			NX_BLOCK_MIN_COINS_HINT: "How many coins must be left before the Archdemon, this number counts. Empty means any. The final shopping stops as soon as the minimum is out of reach",
			NX_MIN_COINS_PLACEHOLDER: "empty means no condition",
			NX_MIN_COINS_BONUS: "{talisman}: +{percent}% attack",
			NX_STALL_COIN: "Stall coin",
			NX_ANY_TALISMAN: "<span style=\"color: LimeGreen;\">Any emblem</span>",
			NX_ERR_NO_CHAPTER: "Pick a chapter",
			NX_ERR_BLOCKS: "From one to five blocks are needed, like 25/1/6001, 27/3/6002, ...",
			NX_ERR_BLOCK_FORMAT: "Block <span style=\"color: Red;\">{block}</span> is malformed. Expected heroId/rank/petId",
			NX_ERR_HERO: "{hero} is not allowed in this event",
			NX_ERR_HERO_DUP: "{hero} is listed twice",
			NX_ERR_RANK: "Rank in block <span style=\"color: Red;\">{block}</span> must be from 1 to 7",
			NX_ERR_PET: "No such pet in block <span style=\"color: Red;\">{block}</span>",
			NX_ERR_PET_DUP: "You messed up: {pet} is set as patron for two heroes at once",
			NX_ERR_FAVOR: "{pet} does not patronize {hero}",
			NX_ERR_TALISMAN: "Pick an emblem",
			NX_ERR_MIN_COINS: "Minimum coins is a whole number, or leave it empty",
			NX_ATTEMPT: "ArchRank — run <span style=\"color: LimeGreen;\">{attempt}</span>",
			NX_SHOPPING: "Shopping. Coins: <span style=\"color: LimeGreen;\">{coins}</span>, heroes left {heroes}, pets left {pets}",
			NX_MISSION: "Mission <span style=\"color: LimeGreen;\">{missionNumber}</span>",
			NX_RETRY: "Run {attempt} failed. {reason}<br>Resetting the chapter",
			NX_READY: `<span style="font-size: 25px;">Everything is collected on run <span style="color: LimeGreen;">{attempt}</span></span><br>
          Coins left: <span style="color: LimeGreen;">{coins}</span><br>
          Capital bonus: <span style="color: LimeGreen;">{percent}</span>%<br>
          Every point before the Archdemon is taken, the emblems are on. Go in and attack the Archdemon yourself`,
			NX_STOPPED: "Stopped on run {attempt}",
			NX_REASON_NOT_COLLECTED: "Not collected: {list}",
			NX_REASON_MIN_COINS: "{coins} coins left (bonus {percent}%), at least {min} needed",
			NX_REASON_MIN_COINS_UNREACHABLE: "Minimum is out of reach: {coins} + sale {resale} + margin {slack} = {projected} < {min}",
			NX_REASON_NO_LIVES: "Lives are over",
			NX_REASON_NO_TALISMAN: "The required emblem was not offered",
			NX_REASON_NO_MISSIONS: "No missions left in the chapter",
			NX_REASON_STOPPED: "Stopped by you",
			NX_COOLDOWN: "Restart in {seconds} s",
			NX_BLOCK_CARRY: "Carry heroes, they only walk you through",
			NX_BLOCK_CARRY_HINT: "On point 1 at least purple is a must, up to the chosen rank they are topped up as soon as possible. Sold after the last point before the Archdemon",
			NX_BLOCK_SACRIFICE: "Who throws the point",
			NX_BLOCK_SACRIFICE_HINT: "Up to five heroes. One throws, the weakest owned: a Support, then a Tank, then anyone, the fewest fragments first. It loses the chosen point twice on purpose, then the carry team takes it",
			NX_BLOCK_SACRIFICE_REFRESH: "Stall refreshes on the throw point to find the throwing hero",
			NX_BLOCK_SACRIFICE_REFRESH_HINT: "Needed when none of them is a carry hero: then one is bought on the throw point. Zero means no refreshes, if nobody is there the run restarts",
			NX_ERR_SACRIFICE_REFRESH: "Refreshes for the throwing hero must be a whole number from 0 to {max}",
			NX_SACRIFICE_EDIT_HINT: "Pick up to five heroes",
			NX_SACRIFICE_REFRESH: "Looking for the throwing hero, refresh {refreshes} of {max}",
			NX_ERR_CARRY: "Pick the carry heroes with «Edit»",
			NX_PICK_CARRY_TITLE: "Carry heroes",
			NX_PICK_SACRIFICE_TITLE: "Who throws the point",
			NX_LIST_EDIT_HINT: "Pick up to five heroes and their ranks",
			NX_ERR_SACRIFICE: "Pick one to {max} heroes to throw the point with «Edit»",
			NX_BLOCK_START_REFRESH: "Spare stall refreshes on point 1",
			NX_BLOCK_START_REFRESH_HINT: "How many refreshes are allowed when the round did not buy enough unknown pairs to earn one. Zero means earned refreshes only",
			NX_ERR_START_REFRESH: "Spare refreshes must be a whole number from 0 to {max}",
			NX_REASON_NO_CARRY_EXTRA: "None of the extra carry heroes were on sale: {list}",
			NX_WEALTH_SHOP: "Point {point}, stall. Coins: <span style=\"color: LimeGreen;\">{coins}</span>",
			NX_WEALTH_FINAL: "Selling the carry heroes and collecting the real team",
			NX_SACRIFICE: "Throwing the point on purpose, <span style=\"color: LimeGreen;\">{number}</span> of {total}",
			NX_REASON_SACRIFICE_WON: "The throwing lineup won, which breaks the plan",
			NX_REASON_NO_CARRY: "Carry heroes were not on sale: {list}",
			NX_ERR_CARRY_POINT1: "Carry heroes {list} cannot be had by point 1 of this chapter: they are neither starting heroes nor sold in the first stall. The Capital run would reset the chapter endlessly. Pick others. Starting heroes of the chapter: {start}",
			NX_CARRY_NEVER_ON_SALE: "Carry heroes {list} were not on sale at point 1 even once in {attempts} runs in a row: it looks like they cannot be had by point 1. The run is stopped, pick other carry heroes",
			NX_REASON_POINT_LOST: "Point {point} was not taken",
			NX_REASON_POINT_LOST_REMEMBERED: "Point {point} was not taken, this team is remembered",
			NX_EVENT_ENDING: "Less than {minutes} minutes are left until the event ends. No new runs are started",
			NX_BLOCK_SACRIFICE_POINT: "Which point to throw",
			NX_BLOCK_SACRIFICE_POINT_HINT: "Coins come out the same on points 5 to 7. On point 7 the enemy is stronger, so losing on purpose is easier",
			NX_SACRIFICE_POINT_5: "Point 5",
			NX_SACRIFICE_POINT_7: "Point 7, the last before the Archdemon",
			NX_SPEND_EXTRA: "Spending extra coins: {coins} ({percent}%), the author had {target}%",
			NX_PRESETS_LINE: "Or pick a ready-made build",
			NX_PRESETS_BUTTON: "Ready-made builds",
			NX_PRESETS_BUTTON_HINT: "Builds of other players from open videos: team, pet and emblems. Your settings here stay as they are",
			NX_PRESETS_BUFF: "Your buff: {buff}",
			NX_PRESETS_KEEP_COINS: "Keep extra coins (extra coins can both raise and lower the damage)",
			NX_PRESETS_KEEP_COINS_HINT: "A build is made for as many coins as its author had: they set the Emblem of Capital bonus. Checked: extra coins stay and the bonus is higher than the author had. Unchecked: the extra is spent on stall refreshes, 3 coins each, until the bonus matches the author",
			NX_PRESETS_SOURCES: "The builds come from open videos of players. Thanks to the sites that collected them:",
			NX_PRESETS_SITE_HWDAILY: "guides and teams for Hero Wars events. Author Fragator, reachable on the official Hero Wars Discord",
			NX_PRESETS_SITE_HWMAP: "game database and event teams. Author Kircheis",
			NX_PRESETS_AUTHORS: "Every build has an author. If a build helped you, drop by their video and leave a 👍",
			NX_PRESETS_HEAD_DAMAGE: "Damage",
			NX_PRESETS_HEAD_BUFF: "Buff",
			NX_PRESETS_HEAD_COINS: "Coins",
			NX_PRESETS_HEAD_TALISMANS: "Emblems",
			NX_PRESETS_HEAD_PET: "Pet",
			NX_PRESETS_HEAD_HEROES: "Heroes",
			NX_PRESETS_HEAD_AUTHOR: "Author",
			NX_PRESETS_BILLION: "{value}B",
			NX_PRESETS_UNKNOWN_AUTHOR: "N/A",
			NX_PRESETS_VIDEO: "Open the video",
			NX_PRESETS_NO_PET: "No main pet",
			NX_PRESETS_GO: "Let's go",
			NX_PRESETS_GO_HINT: "Run the chosen chapter with this build: carry {carry}, {sacrifice} throws point {point}, no spare refreshes and no unknown cards",
			NX_PRESETS_BACK: "Back",
			NX_PRESETS_LOADING: "Loading the builds…",
			NX_PRESETS_WAIT_SOON: "Ready-made builds for this event will appear on the last day of the Adventure. Until then, try it on your own: put a team together and grab your spot on the leaderboard!",
			NX_PRESETS_WAIT_RESOURCES: "Archdemon build examples and lots of other useful game info are here:",
			NX_PRESETS_TG_HELPER: "the group of HeroWarsHelper and many other useful scripts",
			NX_PRESETS_TG_GOODWIN: "a friendly player community and lots of useful info",
			NX_PRESETS_WAIT_YOUTUBE: "YouTube — useful game videos and Archdemon builds",
			NX_PRESETS_WAIT_SITES: "Websites",
			NX_PRESETS_ERROR: "The request cannot be completed from your region. Please use additional tools",
			NX_PRESETS_STALE: "The server did not answer, showing the saved copy",
			NX_PRESETS_CARRY_POINT1: "Ready-made builds are made for the carry heroes {list} of the previous event: in this one they cannot be had by point 1. Wait for an add-on update or set the run up in the setup window",
			NX_PRESETS_REFRESH: "Refresh the builds from the server, at most once a minute",
			NX_PRESETS_REFRESH_WAIT: "You can refresh again in {seconds} s",
			NX_REASON_POINT_KNOWN_LOSS: "Point {point}: this team has already lost it, and there is nobody to buy",
			NX_DEFAULT_FINAL: "Selling the extra heroes and collecting the team",
			NX_BLOCK_STOP_INCOMPLETE: "Stop before the Archdemon even if the team is not complete",
			NX_BLOCK_STOP_INCOMPLETE_HINT: "If hero parts or pets are still missing after the final shopping, the run stops instead of restarting the chapter. The window lists what is missing",
			NX_INCOMPLETE: `<span style="font-size: 25px;">The team is not complete, run <span style="color: LimeGreen;">{attempt}</span></span><br>
          Missing: <span style="color: #ff6b6b;">{list}</span><br>
          Every point before the Archdemon is taken. Go in and attack the Archdemon yourself`,
			NX_REASON_NO_SACRIFICE: "Nobody to throw the point with, none of these heroes is owned: {list}",
			NX_POINT1_REFRESH: "Point 1, earned refresh <span style=\"color: LimeGreen;\">{refreshes}</span>, unknown lots taken {bought}, coins {coins}",
			NX_BLOCK_PAUSE: "Stop right before the Archdemon",
			NX_BLOCK_PAUSE_HINT: "Shows coins and pinned slots before the final shopping, then lets you continue or stop",
			NX_AFTER_BOSS_REPORT: "<span style=\"font-size: 22px;\">All points before the Archdemon are taken, run {attempt}</span><br>{body}",
			NX_CONTINUE: "Continue",
			NX_HALT: "Stop here",
			NX_HALTED_SYNC: `Stopped before the Archdemon. The chapter is <span style="color: LimeGreen;">not reset</span>.<br>
          The game data will now be synced so the client sees the real state.
          The page is <span style="color: LimeGreen;">not</span> reloaded.<br>
          After that, go in and look at the coins.`,
			NX_BLOCK_TALISMAN_POINT: "Emblem {rollNumber}, before battle {bossNumber}",
			NX_ERR_TALISMAN_DUP: "The same emblem cannot be taken on both points: the worn one is not offered again",
			NX_ERR_NO_FREE_ABYSS: "This event has no free Abyss chapter",
			NX_ERR_PAID_CHAPTER: "Entering this chapter now costs Abyss Seals. The run is stopped, nothing is spent",
			NX_ERR_HELPER_OLD: "HeroWarsHelper {version} is too old for the add-on, missing: {list}. Update the helper: the add-on works with 2.459 and newer",
			NX_ERR_RESULT_INVALID: "The game server did not accept a battle result and counted an auto-battle instead. The run is stopped",
			NX_WEALTH_ONLY_NOTE: "Capital strategy settings appear when the Emblem of Capital is picked for point 1",
			NX_BLOCK_RANDOM_ANY: "Buy unknown cards at any price",
			NX_BLOCK_RANDOM_ANY_HINT: "Unchecked: only when cheaper than {price}, then resale pays them back. Checked: always, in case needed heroes are inside",
			NX_LOG_STOP: "Stop",
			NX_LOG_COLLAPSE: "Collapse the log to two lines",
			NX_LOG_EXPAND: "Expand the log",
			NX_LOG_POINT: "point {point}",
			NX_LOG_COINS: "{coins} coins",
			NX_POINT_TAKEN: "Point {point} taken",
			NX_PROGRESS_TEAM: "Team",
			NX_PROGRESS_CARRY: "Carry",
			NX_PROGRESS_SACRIFICE: "To throw",
			NX_PROGRESS_PETS: "Pets",
			NX_EVENT_PIN: "Pinned",
			NX_UPDATE_SHORT: "{version} is out",
			NX_UPDATE_BUTTON: "Update",
			NX_UPDATE_HINT: "Opens the add-on page on Greasy Fork. Reload the game page after updating",
			NX_EVENT_UNPIN: "Unpinned",
			NX_EVENT_BUY: "Bought for <span style=\"color: LimeGreen;\">{coins}</span>",
			NX_EVENT_SELL: "Sold for <span style=\"color: LimeGreen;\">{coins}</span>",
			NX_LOG_STOPPING: "Stopping…",
			NX_REPLACING: "Stopping the previous run…",
			NX_LOG_LAST_FAIL: "Last failed run {attempt}: {reason}",
			NX_TIMER_SEARCH: "Picking the battle timer {count} of {max}",
			NX_WIN_FOUND_WAIT: "Winning battle found, sending it in {seconds} s",
			NX_WIN_SENT: "Winning battle sent",
			NX_WIN_NOT_FOUND: "No winning battle found, the plain auto battle goes",
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
			NX_PICK_SEARCH: "Search by name",
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
			NX_NO_EVENT: "No Adventure is running right now",
			NX_NO_ABYSS: "This Adventure has no Abyss and no Archdemon. The add-on works only in Adventures with the Abyss",
			NX_FAILED: "The run broke down<br>Add-on version {version}",
			NX_START_FAILED: "Could not open the setup window<br>Add-on version {version}",
			NX_DETAILS: "Details",
			NX_FAIL_NO_STALL: "The event stall was not found in the game data",
			NX_FAIL_NO_STATE: "The server did not send the chapter state after the battle",
			NX_TALISMAN_TAKEN: "Emblem on: {name}",
			NX_CHAPTER: "Chapter",
			NX_CANCEL: "Cancel",
			NX_ENTERING: "Entering the chapter",
			NX_FREE: "<span style=\"color: LimeGreen;\">free</span>",
			NX_NEED_RELIC: "<span style=\"color: #ff6b6b;\">{relicName} level {needLevel} is needed, yours is {haveLevel}</span>"
		},
		ru: {
			NX_LANG: "ru",
			NX_SETUP_MESSAGE: "<span style=\"font-size: 25px;\">ArchRank</span><br><span style=\"font-size: 14px;\">Проверьте настройки и нажмите Начать</span>",
			NX_BLOCK_CHAPTER: "Глава",
			NX_BLOCK_MIN_COINS: "{coin}: минимум, включительно",
			NX_BLOCK_MIN_COINS_HINT: "Сколько монет должно остаться перед Архидемоном, само число подходит. Пусто значит любой остаток. Финальная закупка прекращается, как только минимум не достижим",
			NX_MIN_COINS_PLACEHOLDER: "пусто — без условия",
			NX_MIN_COINS_BONUS: "{talisman}: +{percent}% к атаке",
			NX_STALL_COIN: "Монета лавки",
			NX_ANY_TALISMAN: "<span style=\"color: LimeGreen;\">Любая эмблема</span>",
			NX_ERR_NO_CHAPTER: "Выберите главу",
			NX_ERR_BLOCKS: "Нужно от одного до пяти блоков вида 25/1/6001, 27/3/6002, ...",
			NX_ERR_BLOCK_FORMAT: "Блок <span style=\"color: Red;\">{block}</span> кривой. Ожидается IdГероя/ранг/IdПитомца",
			NX_ERR_HERO: "{hero} не допущен к событию",
			NX_ERR_HERO_DUP: "{hero} указан дважды",
			NX_ERR_RANK: "Ранг в блоке <span style=\"color: Red;\">{block}</span> должен быть от 1 до 7",
			NX_ERR_PET: "Нет такого питомца в блоке <span style=\"color: Red;\">{block}</span>",
			NX_ERR_PET_DUP: "Налажали: {pet} поставлен покровителем сразу двум героям",
			NX_ERR_FAVOR: "{pet} не покровительствует герою {hero}",
			NX_ERR_TALISMAN: "Выберите эмблему",
			NX_ERR_MIN_COINS: "Минимум монет — целое число или пусто",
			NX_ATTEMPT: "ArchRank — заход <span style=\"color: LimeGreen;\">{attempt}</span>",
			NX_SHOPPING: "Закупка. Монет: <span style=\"color: LimeGreen;\">{coins}</span>, героев осталось {heroes}, питомцев {pets}",
			NX_MISSION: "Миссия <span style=\"color: LimeGreen;\">{missionNumber}</span>",
			NX_RETRY: "Заход {attempt} не сложился. {reason}<br>Сбрасываем главу",
			NX_READY: `<span style="font-size: 25px;">Всё собрано на заходе <span style="color: LimeGreen;">{attempt}</span></span><br>
          Осталось монет: <span style="color: LimeGreen;">{coins}</span><br>
          Бонус капитала: <span style="color: LimeGreen;">{percent}</span>%<br>
          Все точки до Архидемона взяты, эмблемы надеты. Зайдите и атакуйте Архидемона сами`,
			NX_STOPPED: "Остановлено на заходе {attempt}",
			NX_REASON_NOT_COLLECTED: "Не собрано: {list}",
			NX_REASON_MIN_COINS: "Осталось {coins} монет (бонус {percent}%), нужно не меньше {min}",
			NX_REASON_MIN_COINS_UNREACHABLE: "До минимума не дотянуть: {coins} + продажа {resale} + запас {slack} = {projected} < {min}",
			NX_REASON_NO_LIVES: "Закончились жизни",
			NX_REASON_NO_TALISMAN: "Нужная эмблема не выпала",
			NX_REASON_NO_MISSIONS: "В главе не осталось миссий",
			NX_REASON_STOPPED: "Остановлено вами",
			NX_COOLDOWN: "Перезапуск через {seconds} с",
			NX_BLOCK_CARRY: "Проходные герои, ими только идём",
			NX_BLOCK_CARRY_HINT: "На первой точке обязательно хотя бы до фиолетового, до выбранного ранга докупаются при первой возможности. Продаются после последней точки перед Архидемоном",
			NX_BLOCK_SACRIFICE: "Кем сливаем точку",
			NX_BLOCK_SACRIFICE_HINT: "До пяти героев. Сливает один, самый слабый из тех, что на руках: поддержка, потом танк, потом любой — у кого меньше фрагментов. Он дважды намеренно проигрывает выбранную точку, потом её берёт проходной состав",
			NX_BLOCK_SACRIFICE_REFRESH: "Обновлений лавки на точке слива, чтобы найти героя для слива",
			NX_BLOCK_SACRIFICE_REFRESH_HINT: "Нужно, если никого из них нет среди проходных: тогда одного докупают на точке слива. Ноль — без обновлений, никого не нашлось — заход заново",
			NX_ERR_SACRIFICE_REFRESH: "Обновлений для героя слива — целое число от 0 до {max}",
			NX_SACRIFICE_EDIT_HINT: "Выбрать до пяти героев",
			NX_SACRIFICE_REFRESH: "Ищем героя для слива, обновление {refreshes} из {max}",
			NX_ERR_CARRY: "Выберите проходных героев кнопкой «Изменить»",
			NX_PICK_CARRY_TITLE: "Проходные герои",
			NX_PICK_SACRIFICE_TITLE: "Кем сливаем точку",
			NX_LIST_EDIT_HINT: "Выбрать до пяти героев и их ранги",
			NX_ERR_SACRIFICE: "Выберите от одного до {max} героев для слива кнопкой «Изменить»",
			NX_BLOCK_START_REFRESH: "Запас обновлений лавки на первой точке",
			NX_BLOCK_START_REFRESH_HINT: "Сколько раз можно обновить, если за круг не набралось нужного числа неизвестных пар. Ноль значит только заработанные",
			NX_ERR_START_REFRESH: "Запас обновлений это целое число от 0 до {max}",
			NX_REASON_NO_CARRY_EXTRA: "Ни одного дополнительного проходного не было в продаже: {list}",
			NX_WEALTH_SHOP: "Точка {point}, лавка. Монет: <span style=\"color: LimeGreen;\">{coins}</span>",
			NX_WEALTH_FINAL: "Продаём проходных и собираем основной состав",
			NX_SACRIFICE: "Намеренно сливаем точку, <span style=\"color: LimeGreen;\">{number}</span> из {total}",
			NX_REASON_SACRIFICE_WON: "Сливающий состав выиграл, это ломает план",
			NX_REASON_NO_CARRY: "Проходных не было в продаже: {list}",
			NX_ERR_CARRY_POINT1: "Проходных {list} к точке 1 этой главы не взять: их нет ни среди стартовых героев, ни в первой лавке. Прогон под капитал сбрасывал бы главу без конца. Выберите других. Стартовые герои главы: {start}",
			NX_CARRY_NEVER_ON_SALE: "Проходных {list} ни разу не было в лавке на точке 1 за {attempts} заходов подряд: похоже, к точке 1 их не взять. Прогон остановлен, выберите других проходных",
			NX_REASON_POINT_LOST: "Точка {point} не взята",
			NX_REASON_POINT_LOST_REMEMBERED: "Точка {point} не взята, состав запомнили",
			NX_EVENT_ENDING: "До конца события меньше {minutes} минут. Новых заходов не начинаем",
			NX_BLOCK_SACRIFICE_POINT: "На какой точке сливаем",
			NX_BLOCK_SACRIFICE_POINT_HINT: "По монетам точки с 5-й по 7-ю одинаковы. На седьмой противник сильнее, и проиграть нарочно проще",
			NX_SACRIFICE_POINT_5: "Точка 5",
			NX_SACRIFICE_POINT_7: "Точка 7, последняя перед Архидемоном",
			NX_SPEND_EXTRA: "Тратим лишние монеты: {coins} ({percent}%), у автора {target}%",
			NX_PRESETS_LINE: "Или выберите готовую сборку",
			NX_PRESETS_BUTTON: "Готовые сборки",
			NX_PRESETS_BUTTON_HINT: "Сборки других игроков из открытых видео: команда, питомец и эмблемы. Ваши настройки здесь не меняются",
			NX_PRESETS_BUFF: "Ваше усиление: {buff}",
			NX_PRESETS_KEEP_COINS: "Оставлять лишние монеты (лишние монеты могут как увеличить урон, так и уменьшить)",
			NX_PRESETS_KEEP_COINS_HINT: "Сборка рассчитана на столько монет, сколько было у автора: от них зависит бонус Эмблемы капитала. С галкой лишние монеты остаются, бонус выше, чем у автора. Без галки лишнее тратится обновлениями лавки по 3 монеты, пока бонус не станет как у автора",
			NX_PRESETS_SOURCES: "Сборки взяты из открытых видео игроков. Спасибо сайтам, которые их собрали:",
			NX_PRESETS_SITE_HWDAILY: "гайды и составы по событиям Hero Wars. Автор Fragator, связь — в официальном Discord Hero Wars",
			NX_PRESETS_SITE_HWMAP: "база игры и команды по событиям. Автор Kircheis",
			NX_PRESETS_AUTHORS: "У каждой сборки есть автор. Если сборка помогла, загляните к нему на видео и поставьте 👍",
			NX_PRESETS_HEAD_DAMAGE: "Урон",
			NX_PRESETS_HEAD_BUFF: "Усиление",
			NX_PRESETS_HEAD_COINS: "Монеты",
			NX_PRESETS_HEAD_TALISMANS: "Эмблемы",
			NX_PRESETS_HEAD_PET: "Питомец",
			NX_PRESETS_HEAD_HEROES: "Герои",
			NX_PRESETS_HEAD_AUTHOR: "Автор",
			NX_PRESETS_BILLION: "{value} млрд",
			NX_PRESETS_UNKNOWN_AUTHOR: "н/д",
			NX_PRESETS_VIDEO: "Открыть видео",
			NX_PRESETS_NO_PET: "Без основного питомца",
			NX_PRESETS_GO: "Поехали",
			NX_PRESETS_GO_HINT: "Пройти выбранную главу по этой сборке: проходные {carry}, точку {point} сливает {sacrifice}, без запаса обновлений и без неизвестных карт",
			NX_PRESETS_BACK: "Назад",
			NX_PRESETS_LOADING: "Загружаем сборки…",
			NX_PRESETS_WAIT_SOON: "Готовые сборки для этого события появятся в последний день Приключения. А пока попробуйте свои силы: подберите команду сами и успейте занять место в рейтинге!",
			NX_PRESETS_WAIT_RESOURCES: "Примеры сборок для Архидемона и много другой полезной информации по игре вы найдёте здесь:",
			NX_PRESETS_TG_HELPER: "группа HeroWarsHelper и множества других полезных скриптов",
			NX_PRESETS_TG_GOODWIN: "дружное сообщество игроков и много полезной информации",
			NX_PRESETS_WAIT_YOUTUBE: "YouTube — полезные видео по игре и сборки для Архидемона",
			NX_PRESETS_WAIT_SITES: "Сайты",
			NX_PRESETS_ERROR: "Для вашего региона невозможно выполнить запрос. Воспользуйтесь дополнительными инструментами",
			NX_PRESETS_STALE: "Сервер не ответил, показана сохранённая копия",
			NX_PRESETS_CARRY_POINT1: "Готовые сборки рассчитаны на проходных {list} прошлого события, в этом их к точке 1 не взять. Дождитесь обновления дополнения или настройте прогон в окне настройки",
			NX_PRESETS_REFRESH: "Обновить сборки с сервера, не чаще раза в минуту",
			NX_PRESETS_REFRESH_WAIT: "Обновить можно через {seconds} с",
			NX_REASON_POINT_KNOWN_LOSS: "Точка {point}: этот состав её уже не брал, а докупить некого",
			NX_DEFAULT_FINAL: "Продаём лишних героев и собираем состав",
			NX_BLOCK_STOP_INCOMPLETE: "Остановиться перед Архидемоном, даже если состав не собран полностью",
			NX_BLOCK_STOP_INCOMPLETE_HINT: "Если после финальной закупки не хватает частей героев или питомцев, прогон останавливается, а не начинает главу заново. В окне — чего не хватило",
			NX_INCOMPLETE: `<span style="font-size: 25px;">Состав собран не полностью, заход <span style="color: LimeGreen;">{attempt}</span></span><br>
          Не хватает: <span style="color: #ff6b6b;">{list}</span><br>
          Все точки до Архидемона взяты. Заходи и бей Архидемона сам`,
			NX_REASON_NO_SACRIFICE: "Нечем сливать точку, никого из этих героев нет в наличии: {list}",
			NX_POINT1_REFRESH: "Точка 1, заработанное обновление <span style=\"color: LimeGreen;\">{refreshes}</span>, неизвестных взято {bought}, монет {coins}",
			NX_BLOCK_PAUSE: "Остановиться прямо перед Архидемоном",
			NX_BLOCK_PAUSE_HINT: "Покажет монеты и закреплённые слоты до финальной закупки, дальше можно продолжить или остановиться",
			NX_AFTER_BOSS_REPORT: "<span style=\"font-size: 22px;\">Все точки до Архидемона взяты, заход {attempt}</span><br>{body}",
			NX_CONTINUE: "Продолжить",
			NX_HALT: "Остановиться",
			NX_HALTED_SYNC: `Остановились перед Архидемоном. Глава <span style="color: LimeGreen;">не сброшена</span>.<br>
          Сейчас данные игры синхронизируются, чтобы клиент увидел настоящее состояние.
          Страница при этом <span style="color: LimeGreen;">не</span> перезагружается.<br>
          После этого зайдите и посмотрите монеты.`,
			NX_BLOCK_TALISMAN_POINT: "Эмблема {rollNumber}, перед боем {bossNumber}",
			NX_ERR_TALISMAN_DUP: "Одну и ту же эмблему на обе точки не взять: надетую второй раз не предлагают",
			NX_ERR_NO_FREE_ABYSS: "В этом событии нет бесплатной главы Бездны",
			NX_ERR_PAID_CHAPTER: "Вход в эту главу теперь стоит Печатей Бездны. Прогон остановлен, ничего не потрачено",
			NX_ERR_HELPER_OLD: "HeroWarsHelper {version} слишком старый для дополнения, нет: {list}. Обновите помощника: дополнение работает с 2.459 и новее",
			NX_ERR_RESULT_INVALID: "Сервер игры не принял результат боя и засчитал автобой. Прогон остановлен",
			NX_WEALTH_ONLY_NOTE: "Настройки стратегии капитала появятся, если на первой точке выбрать Эмблему капитала",
			NX_BLOCK_RANDOM_ANY: "Скупать неизвестные карты по любой цене",
			NX_BLOCK_RANDOM_ANY_HINT: "Без галки: только дешевле {price}, тогда их окупает продажа. С галкой: всегда, вдруг там нужные герои",
			NX_LOG_STOP: "Стоп",
			NX_LOG_COLLAPSE: "Свернуть журнал до двух строк",
			NX_LOG_EXPAND: "Развернуть журнал",
			NX_LOG_POINT: "точка {point}",
			NX_LOG_COINS: "монет {coins}",
			NX_POINT_TAKEN: "Точка {point} взята",
			NX_PROGRESS_TEAM: "Состав",
			NX_PROGRESS_CARRY: "Проходные",
			NX_PROGRESS_SACRIFICE: "Для слива",
			NX_PROGRESS_PETS: "Питомцы",
			NX_EVENT_PIN: "Закрепили",
			NX_UPDATE_SHORT: "доступна {version}",
			NX_UPDATE_BUTTON: "Обновить",
			NX_UPDATE_HINT: "Откроется страница дополнения на Greasy Fork. После обновления перезагрузите страницу игры",
			NX_EVENT_UNPIN: "Сняли закреп",
			NX_EVENT_BUY: "Купили за <span style=\"color: LimeGreen;\">{coins}</span>",
			NX_EVENT_SELL: "Продали за <span style=\"color: LimeGreen;\">{coins}</span>",
			NX_LOG_STOPPING: "Останавливаем…",
			NX_REPLACING: "Останавливаем прошлый прогон…",
			NX_LOG_LAST_FAIL: "Прошлый неудачный заход {attempt}: {reason}",
			NX_TIMER_SEARCH: "Подбор таймера боя {count} из {max}",
			NX_WIN_FOUND_WAIT: "Комбинация победы найдена, отправим через {seconds} с",
			NX_WIN_SENT: "Победа отправлена",
			NX_WIN_NOT_FOUND: "Победа не найдена, уходит обычный автобой",
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
			NX_PICK_SEARCH: "Поиск по имени",
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
			NX_NO_EVENT: "Сейчас Приключение не идёт",
			NX_NO_ABYSS: "В этом Приключении нет Бездны и Архидемона. Дополнение работает только в Приключениях с Бездной",
			NX_FAILED: "Прогон сорвался<br>Версия дополнения {version}",
			NX_START_FAILED: "Не удалось открыть окно настройки<br>Версия дополнения {version}",
			NX_DETAILS: "Подробнее",
			NX_FAIL_NO_STALL: "В данных игры не нашлась лавка события",
			NX_FAIL_NO_STATE: "Сервер не прислал состояние главы после боя",
			NX_TALISMAN_TAKEN: "Надели эмблему: {name}",
			NX_CHAPTER: "Глава",
			NX_CANCEL: "Отмена",
			NX_ENTERING: "Входим в главу",
			NX_FREE: "<span style=\"color: LimeGreen;\">бесплатно</span>",
			NX_NEED_RELIC: "<span style=\"color: #ff6b6b;\">нужен {relicName} {needLevel} уровня, у вас {haveLevel}</span>"
		}
	};
	var popup;
	var confShow;
	var setProgress;
	var I18N;
	var getSaveVal;
	var setSaveVal;
	var addExtentionName;
	var setIsCancalBattle;
	var i18nLangData;
	var othersPopupButtons;
	var WinFixBattle;
	var helperVersion = "?";
	function bindHelper() {
		const funcs = typeof HWHFuncs !== "undefined" && HWHFuncs || {};
		const data = typeof HWHData !== "undefined" && HWHData || {};
		const classes = typeof HWHClasses !== "undefined" && HWHClasses || {};
		({popup, confShow, setProgress, I18N, getSaveVal, setSaveVal, addExtentionName, setIsCancalBattle} = funcs);
		({i18nLangData, othersPopupButtons} = data);
		({WinFixBattle} = classes);
		helperVersion = typeof scriptInfo !== "undefined" ? String(scriptInfo?.version ?? "?") : "?";
	}
	bindHelper();
	function registerTexts() {
		i18nLangData["en"] = Object.assign(i18nLangData["en"], NX_TEXTS.en);
		i18nLangData["ru"] = Object.assign(i18nLangData["ru"], NX_TEXTS.ru);
	}
	function missingHelperApi() {
		const has = {
			popup: typeof popup?.confirm === "function",
			confShow: typeof confShow === "function",
			setProgress: typeof setProgress === "function",
			I18N: typeof I18N === "function",
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
		return Object.keys(has).filter((name) => !has[name]);
	}
	function syncWithoutPopup() {
		const classes = typeof selfGame !== "undefined" ? selfGame : null;
		const Manager = classes?.["game.model.user.NextDayUpdatedManager"];
		const Popups = classes?.["game.mediator.gui.popup.GamePopupManager"];
		const manager = Manager?.instance;
		const proto = Manager?.prototype;
		if (!manager || !proto || !Popups) return false;
		const popupSource = Object.values(proto).filter((fn) => typeof fn === "function").map(String).find((source) => source.includes("UI_POPUP_MESSAGE_DAY_RESET"));
		if (!popupSource) return false;
		const close = /^function\s*\(\)\s*\{\s*[\w$]+\.([\w$]+)\(\)/.exec(popupSource)?.[1];
		const buttons = [...new Set([...popupSource.matchAll(/\(this,this\.([\w$]+)\)/g)].map((m) => m[1]))];
		if (!close || typeof Popups[close] !== "function") return false;
		if (buttons.length !== 1 || typeof proto[buttons[0]] !== "function") return false;
		Popups[close]();
		manager[buttons[0]]();
		return true;
	}
	function syncGame() {
		let silent = false;
		try {
			silent = syncWithoutPopup();
		} catch (e) {
			console.error(e);
		}
		if (silent) {
			Promise.resolve().then(() => cheats.refreshInventory?.()).catch((e) => console.error(e));
			return true;
		}
		Promise.resolve().then(() => cheats.refreshGame()).catch((e) => console.error(e));
		return false;
	}
	function unitName(id) {
		return id ? cheats.translate(`LIB_HERO_NAME_${id}`) : "";
	}
	function unitLabel(id) {
		return `${cheats.translate(`LIB_HERO_NAME_${id}`)} (${id})`;
	}
	function heroById(id) {
		return lib.data.hero?.[id];
	}
	function heroRoles(id) {
		return heroById(id)?.roleExtended ?? [];
	}
	function skillById(id) {
		return lib.data.skill?.[id];
	}
	function battleOrder(id) {
		return Number(heroById(id)?.battleOrder ?? 0);
	}
	function getPetLib() {
		return lib.getData("pet") ?? lib.data.pet;
	}
	function statName(stat) {
		const key = `LIB_BATTLESTATDATA_${String(stat).toUpperCase()}`;
		const value = cheats.translate(key);
		return value && value !== key ? value : String(stat);
	}
	var eventId = 0;
	function setCurrentEventId(id) {
		eventId = Number(id) || 0;
	}
	function currentEventId() {
		return eventId;
	}
	function eventById(id) {
		return Object.values(lib.data.invasion.list).find((e) => e.id == id) ?? null;
	}
	function currentEvent() {
		return eventById(eventId);
	}
	function allChapters() {
		return Object.values(lib.data.invasion.chapter);
	}
	function chapterById(id) {
		return lib.data.invasion.chapter[id];
	}
	function chapterDate(value) {
		return Date.parse(String(value).replace(" ", "T") + "Z");
	}
	function openEventAt(now) {
		const chapter = allChapters().find((c) => chapterDate(c.startDate) <= now && !(chapterDate(c.endDate) <= now));
		return chapter ? eventById(chapter.invasionId) : null;
	}
	function getEventUnitPool(event) {
		try {
			return ((event === void 0 ? currentEvent() : event)?.attackUnitsPool?.availableUnits ?? []).map(Number);
		} catch (e) {
			console.error(e);
			return [];
		}
	}
	function getEventPetIds(event) {
		return getEventUnitPool(event).filter((e) => e > 4400);
	}
	function getEventHeroIds(event) {
		return getEventUnitPool(event).filter((e) => e < 1e3);
	}
	function allTalismans() {
		return Object.values(talismanTable());
	}
	function talismanById(id) {
		return talismanTable()[id];
	}
	function talismanTable() {
		return lib.data.invasion?.emblems ?? {};
	}
	function emblemName(id) {
		const key = `LIB_EMBLEM_NAME_${id}`;
		const name = cheats.translate(key);
		return name && name !== key ? name : cheats.translate(`LIB_TALISMAN_NAME_${id}`);
	}
	function stallShopId() {
		const bound = allShops().filter((shop) => shop.requirements?.invasion?.id === currentEventId());
		if (bound.length === 1) return bound[0].id;
		const heroChapter = allChapters().find((chapter) => chapter.invasionId === currentEventId() && chapter.settings?.unitType === "hero" && chapter.settings?.stallShopId);
		if (heroChapter) return heroChapter.settings.stallShopId;
		return currentEvent()?.settings?.stallShopId ?? false;
	}
	function allShops() {
		return Object.values(lib.data.shop);
	}
	function shopById(id) {
		return lib.data.shop?.[id];
	}
	function relicById(id) {
		return lib.data.workshop?.relic?.[id];
	}
	function allAdventureBuffs() {
		return Object.values(lib.data.adventure.buff);
	}
	function toRoman(number) {
		const signs = [
			[10, "X"],
			[9, "IX"],
			[5, "V"],
			[4, "IV"],
			[1, "I"]
		];
		let text = "";
		let rest = Number(number) || 0;
		for (const [value, sign] of signs) while (rest >= value) {
			text += sign;
			rest -= value;
		}
		return text;
	}
	function getTalismanRollBosses(chapterId) {
		const rollBosses = chapterById(chapterId)?.settings?.emblemRollBosses;
		return Array.isArray(rollBosses) && rollBosses.length ? rollBosses : [0];
	}
	function getAbyssChapters() {
		return allChapters().filter((e) => e.invasionId === currentEventId() && e.isArchdemon);
	}
	function eventHasAbyss(eventId) {
		return allChapters().some((e) => e.invasionId === Number(eventId) && e.isArchdemon);
	}
	function getAbyssRelicName() {
		const relicId = currentEvent()?.settings?.relicId;
		try {
			const relic = relicById(relicId);
			return relic?.nameLocale ? cheats.translate(relic.nameLocale) : "";
		} catch {
			return "";
		}
	}
	function chapterEndsAt(chapterId) {
		return chapterDate(chapterById(chapterId)?.endDate);
	}
	function isPaidChapter(chapterId) {
		return hasCost(chapterById(chapterId)?.startCost);
	}
	function hasCost(cost) {
		if (cost && typeof cost === "object") return Object.values(cost).some(hasCost);
		return Number(cost) > 0;
	}
	function chapterTitle(chapter, number) {
		const numeral = `<span style="font-family: 'Times New Roman';">${toRoman(number)}</span>`;
		const key = chapter.clientData?.titleLocale;
		let name = "";
		try {
			name = key ? cheats.translate(key) : "";
		} catch {
			name = "";
		}
		return name && name !== key ? `${numeral}&nbsp;${name}` : `${I18N("NX_CHAPTER")}&nbsp;${numeral}`;
	}
	var STACK_LINES = 8;
	var MESSAGE_CHARS = 600;
	function clip(text, limit) {
		return text.length > limit ? `${text.slice(0, limit)}…` : text;
	}
	function shortenStackLine(line) {
		return line.replace(/[a-z][\w+.-]*:\/\/[^\s()]*?[?&]name=([^&\s():]+)[^\s():]*/gi, (_, name) => {
			try {
				return decodeURIComponent(name);
			} catch {
				return name;
			}
		}).replace(/[a-z][\w+.-]*:\/\/[^\s()]*\/([^/\s():?#]+)(?:[?#][^\s():]*)?/gi, "$1");
	}
	function describeError(error) {
		if (error === null || error === void 0 || error === "") return "";
		if (typeof error === "string") return error;
		const err = error;
		if (typeof err === "object" && typeof err.message === "string") {
			const name = typeof err.name === "string" && err.name ? err.name : "Error";
			const head = clip(`${name}: ${err.message}`.trim(), MESSAGE_CHARS);
			const message = err.message;
			return [head, ...String(err.stack ?? "").split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith(`${name}:`) && !message.includes(line)).slice(0, STACK_LINES).map((line) => `  ${shortenStackLine(line)}`)].join("\n");
		}
		try {
			return clip(JSON.stringify(error) ?? String(error), MESSAGE_CHARS);
		} catch {
			return String(error);
		}
	}
	function escapeAttr(value) {
		return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
	function failureHtml(text, error) {
		const details = describeError(error);
		if (!details) return text;
		return `${text}<details style="margin-top: 10px;"><summary style="cursor: pointer;">${escapeAttr(I18N("NX_DETAILS"))}</summary><pre style="margin: 6px 0 0; padding: 6px 8px; max-height: 220px; overflow: auto; text-align: left; white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.35; background: rgba(0, 0, 0, 0.3); border-radius: 4px; user-select: text; -webkit-user-select: text;">${escapeAttr(details)}</pre></details>`;
	}
	function rankStep(fragments) {
		if (fragments >= 7) return 7;
		if (fragments >= 3) return 3;
		return 1;
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
		if (id < 100) id = 6e3 + id;
		return getPetLib()[id] ? id : -1;
	}
	function minCoinsForPercent(percent) {
		const target = Number(percent);
		if (!Number.isFinite(target) || target <= 0) return 0;
		let low = 0;
		let high = 1e6;
		while (low < high) {
			const middle = Math.floor((low + high) / 2);
			if (coinsToPercent(middle) >= target) high = middle;
			else low = middle + 1;
		}
		return low;
	}
	function parseMinCoins(raw) {
		const value = String(raw ?? "").replace(/\s+/g, "");
		if (value === "") return { value: null };
		if (!/^\d+$/.test(value)) return null;
		return { value: Number(value) };
	}
	function coinsToPercent(coins) {
		let multiplier = .3;
		try {
			const talisman = allTalismans().find((e) => Number(e.id) === NX_WEALTH_TALISMAN_ID);
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
		if (blocks.length < 1 || blocks.length > NX_TEAM_SIZE) return {
			kind: "error",
			error: I18N("NX_ERR_BLOCKS")
		};
		const heroes = [];
		const targets = {};
		const favor = {};
		const favorPets = [];
		for (const block of blocks) {
			const parts = block.split("/").map((e) => e.trim());
			if (parts.length !== 3) return {
				kind: "error",
				error: I18N("NX_ERR_BLOCK_FORMAT", { block })
			};
			const heroId = Number(parts[0]);
			if (!Number.isInteger(heroId) || heroId <= 0) return {
				kind: "error",
				error: I18N("NX_ERR_BLOCK_FORMAT", { block })
			};
			if (heroes.includes(heroId)) return {
				kind: "error",
				error: I18N("NX_ERR_HERO_DUP", { hero: unitLabel(heroId) })
			};
			if (eventHeroes.length > 0 && !eventHeroes.includes(heroId)) return {
				kind: "error",
				error: I18N("NX_ERR_HERO", { hero: unitLabel(heroId) })
			};
			const rank = Number(parts[1]);
			if (!Number.isInteger(rank) || rank < 1 || rank > 7) return {
				kind: "error",
				error: I18N("NX_ERR_RANK", { block })
			};
			const petId = normalizePetId(parts[2]);
			if (petId === -1) return {
				kind: "error",
				error: I18N("NX_ERR_PET", { block })
			};
			if (petId > 0) {
				if (favorPets.includes(petId)) return {
					kind: "error",
					error: I18N("NX_ERR_PET_DUP", { pet: unitLabel(petId) })
				};
				if (!(petLib[petId]?.favorHeroes ?? []).map(Number).includes(heroId)) return {
					kind: "error",
					error: I18N("NX_ERR_FAVOR", {
						pet: unitLabel(petId),
						hero: unitLabel(heroId)
					})
				};
				favorPets.push(petId);
				favor[heroId] = petId;
			}
			heroes.push(heroId);
			targets[heroId] = rankToFragments(rank);
		}
		return {
			kind: "team",
			heroes,
			targets,
			favor,
			favorPets
		};
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
			if (!list.some((e) => e.id === id)) list.push({
				id,
				rank: rankToFragments(rank)
			});
		}
		return list;
	}
	function parseIdList(raw) {
		const ids = String(raw ?? "").split(/[,\s]+/).map((e) => e.trim()).filter((e) => e !== "").map(Number);
		if (ids.length === 0) return null;
		if (ids.some((e) => !Number.isInteger(e) || e <= 0)) return null;
		return [...new Set(ids)];
	}
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
		if (setup.carryHeroes.includes(heroId)) return Math.max(0, 1 - have);
		const extras = setup.carryExtraHeroes ?? [];
		if (extras.length > 0 && extras.includes(heroId) && !carryExtraOwned(setup, fragments)) return Math.max(0, 1 - have);
		return 0;
	}
	function carryRankNeedFor(setup, fragments, heroId) {
		if (!setup.carryHeroes.includes(heroId)) return 0;
		return Math.max(0, Number(setup.carryTargets?.[heroId] ?? 1) - Number(fragments[heroId] ?? 0));
	}
	function sacrificeOwned(setup, fragments) {
		return (setup.sacrificeHeroes ?? []).some((id) => Number(fragments[id] ?? 0) > 0);
	}
	function sacrificeNeeded(setup, fragments) {
		const candidates = setup.sacrificeHeroes ?? [];
		return candidates.length > 0 && !candidates.some((id) => setup.carryHeroes.includes(id)) && !sacrificeOwned(setup, fragments);
	}
	function pickSacrificeHero(setup, fragments) {
		const tier = (id) => {
			const roles = heroRoles(id);
			for (const [at, role] of NX_SACRIFICE_ROLES.entries()) {
				if (roles[0] === role) return at * 2;
				if (roles.includes(role)) return at * 2 + 1;
			}
			return NX_SACRIFICE_ROLES.length * 2;
		};
		let best = 0;
		for (const id of setup.sacrificeHeroes ?? []) {
			const have = Number(fragments[id] ?? 0);
			if (have <= 0) continue;
			if (!best || tier(id) < tier(best) || tier(id) === tier(best) && have < Number(fragments[best] ?? 0)) best = id;
		}
		return best;
	}
	function collectedState(setup, fragments) {
		const heroesLeft = setup.heroes.filter((heroId) => Number(fragments[heroId] ?? 0) < setup.targets[heroId]);
		const petsLeft = setup.petsToCollect.filter((petId) => Number(fragments[petId] ?? 0) <= 0);
		return {
			heroesLeft,
			petsLeft,
			done: heroesLeft.length === 0 && petsLeft.length === 0
		};
	}
	function fullPricePetsAllowed(setup, fragments) {
		let short = 0;
		for (const heroId of setup.heroes) short += Math.max(0, Number(setup.targets[heroId] ?? 0) - Number(fragments[heroId] ?? 0));
		const petsLeft = setup.petsToCollect.filter((petId) => Number(fragments[petId] ?? 0) <= 0).length;
		return short <= 1 && petsLeft <= 1;
	}
	function checkArchdemonNewConditions(setup, coins, fragments) {
		const state = collectedState(setup, fragments);
		if (!state.done) {
			const list = [...state.heroesLeft, ...state.petsLeft].map(unitLabel).join(", ");
			return {
				kind: "retry",
				reason: I18N("NX_REASON_NOT_COLLECTED", { list }),
				missing: list
			};
		}
		const percent = coinsToPercent(coins);
		if (setup.talismanId === NX_WEALTH_TALISMAN_ID && setup.minCoins != null && coins < setup.minCoins) return {
			kind: "retry",
			reason: I18N("NX_REASON_MIN_COINS", {
				coins,
				percent,
				min: setup.minCoins
			})
		};
		return {
			kind: "ready",
			coins,
			percent
		};
	}
	function applyReward(fragments, reward) {
		if (!reward) return;
		for (const key of ["invasionFragmentHero", "invasionFragmentPet"]) for (const [id, amount] of Object.entries(reward[key] ?? {})) fragments[Number(id)] = Number(fragments[Number(id)] ?? 0) + Number(amount);
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
	function rewardUnits(reward) {
		const out = {};
		applyReward(out, reward);
		return out;
	}
	function progressPlan(setup) {
		const seen = new Set();
		const take = (ids, need) => {
			const units = [];
			for (const id of (ids ?? []).map(Number)) {
				if (!(id > 0) || seen.has(id)) continue;
				seen.add(id);
				units.push({
					id,
					need: Math.max(1, Number(need(id)) || 1)
				});
			}
			return units;
		};
		return [
			{
				kind: "team",
				units: take(setup.heroes, (id) => setup.targets?.[id])
			},
			{
				kind: "carry",
				units: take([...setup.carryHeroes ?? [], ...setup.carryExtraHeroes ?? []], (id) => setup.carryTargets?.[id])
			},
			{
				kind: "sacrifice",
				units: take(setup.sacrificeHeroes, () => 1)
			},
			{
				kind: "pets",
				units: take(setup.petsToCollect, () => 1)
			}
		].filter((group) => group.units.length > 0);
	}
	function pinnedFragments(slots, pinned) {
		const out = {};
		for (const slot of slots) if (pinned.has(slot.id)) applyReward(out, slot.reward);
		delete out[-1];
		return out;
	}
	function sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
	function idle(ms) {
		return new Promise((resolve) => {
			if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: ms });
			else setTimeout(resolve, ms);
		});
	}
	var Ledger = class {
		startCoins = 0;
		entries = {};
		reset(startCoins) {
			this.startCoins = Number(startCoins) || 0;
			for (const key of Object.keys(this.entries)) delete this.entries[key];
		}
		add(category, delta) {
			const value = Number(delta) || 0;
			if (value === 0) return;
			this.entries[category] = (this.entries[category] ?? 0) + value;
		}
		summary(finalCoins) {
			const entries = Object.entries(this.entries).sort((a, b) => a[1] - b[1]);
			const mine = entries.reduce((sum, e) => sum + e[1], 0);
			return {
				entries,
				mine,
				fromPoints: Number(finalCoins) - this.startCoins - mine,
				start: this.startCoins,
				final: Number(finalCoins)
			};
		}
	};
	function pause(range) {
		const [min, max] = range;
		return sleep(min + Math.random() * (max - min));
	}
	function emblemDrops(emblem) {
		return (emblem.weight == null ? 100 : Number(emblem.weight)) > 0;
	}
	function offeredTalismans(answer) {
		if (answer != null && !Array.isArray(answer.emblemIds)) console.warn("Выдача эмблем: нет emblemIds в ответе", answer);
		return (Array.isArray(answer?.emblemIds) ? answer.emblemIds : []).map(Number).filter((id) => Number.isFinite(id) && id > 0 && id !== NX_SALE_TALISMAN_ID);
	}
	function pickTalisman(setup, offered, taken) {
		const wanted = Number(setup.talismanIds?.[taken] ?? 0);
		const pick = wanted ? offered.find((id) => id === wanted) : offered[0];
		console.log("Эмблемы на выбор", JSON.stringify(offered), "выдача", taken + 1, "нужен", wanted || "любой", "берём", pick ?? "ничего");
		return pick;
	}
	var STALL_COIN = 1080;
	function coinsOf(reward) {
		return Number(reward?.coin?.[STALL_COIN] ?? 0);
	}
	var Wallet = class {
		value = 0;
		addReward(reward) {
			const amount = coinsOf(reward);
			this.value += amount;
			return amount;
		}
		async load() {
			this.value = await Caller.send("inventoryGet").then((e) => Number(e.coin[STALL_COIN] ?? 0));
			return this.value;
		}
		async onChapterEntry(chapterInfo, afterReset) {
			const start = chapterInfo?.reward?.coin?.[STALL_COIN];
			if (afterReset && start !== void 0) {
				this.value = Number(start);
				return this.value;
			}
			return await this.load();
		}
	};
	var Stall = class {
		shopId;
		wallet;
		session;
		actions = 0;
		view = [];
		pinnedIds = new Set();
		onChange;
		constructor(shopId, wallet, session, onChange = () => {}) {
			this.shopId = shopId;
			this.wallet = wallet;
			this.session = session;
			this.onChange = onChange;
		}
		pinned() {
			return pinnedFragments(this.view, this.pinnedIds);
		}
		async open(onTalismans) {
			this.actions = 0;
			if (this.session.stopped) return {
				kind: "retry",
				reason: I18N("NX_REASON_STOPPED")
			};
			const offered = offeredTalismans(await Caller.send("invasion_rollEmblems"));
			if (offered.length > 0) {
				await pause(NX_PACE.stallAll);
				await Caller.send("shopGetAll");
				await pause(NX_PACE.talismanPick);
				if (this.session.stopped) return {
					kind: "retry",
					reason: I18N("NX_REASON_STOPPED")
				};
				const reason = onTalismans ? await onTalismans(offered) : I18N("NX_REASON_NO_TALISMAN");
				if (reason) return {
					kind: "retry",
					reason
				};
				await pause(NX_PACE.stallOpen);
				return {
					kind: "open",
					slots: await this.get()
				};
			}
			await pause(NX_PACE.stallOpen);
			const slots = await this.get();
			await pause(NX_PACE.stallAll);
			await Caller.send("shopGetAll");
			return {
				kind: "open",
				slots
			};
		}
		async refresh() {
			try {
				await this.beforeAction();
				const answer = await Caller.send({
					name: "shopRefresh",
					args: { shopId: this.shopId }
				});
				this.wallet.value -= NX_STALL_REFRESH_COST;
				console.log(`${NX_LOG_CASH} обновили лавку, монет ${this.wallet.value}`);
				return this.see(Object.values(answer.slots));
			} catch (e) {
				console.error(e);
				await this.wallet.load();
				return null;
			}
		}
		async buy(slot) {
			await this.beforeAction();
			const reward = await Caller.send({
				name: "shopBuy",
				args: {
					shopId: this.shopId,
					slot: slot.id,
					cost: slot.cost,
					reward: {}
				}
			});
			this.pinnedIds.delete(slot.id);
			const units = rewardUnits(reward);
			this.tell("buy", Object.keys(units).length ? units : rewardUnits(slot.reward), coinsOf(slot.cost));
			return reward;
		}
		async pin(slot) {
			await this.beforeAction();
			await Caller.send({
				name: "shop_pinSlot",
				args: {
					shopId: this.shopId,
					slotId: slot.id
				}
			});
			slot.pinned = true;
			this.pinnedIds.add(slot.id);
			this.onChange();
			this.tell("pin", rewardUnits(slot.reward), coinsOf(slot.cost));
		}
		async unpin(slot) {
			await this.beforeAction();
			await Caller.send({
				name: "shop_unpinSlot",
				args: {
					shopId: this.shopId,
					slotId: slot.id
				}
			});
			slot.pinned = false;
			this.pinnedIds.delete(slot.id);
			this.onChange();
			this.tell("unpin", rewardUnits(slot.reward), coinsOf(slot.cost));
		}
		async sell(fragments, unitId, amount) {
			await this.beforeAction();
			const answer = await Caller.send({
				name: "invasion_fragmentSell",
				args: {
					fragmentId: unitId,
					amount
				}
			});
			fragments[unitId] = 0;
			this.onChange();
			const income = coinsOf(answer);
			this.tell("sell", { [unitId]: amount }, income);
			return income;
		}
		async get() {
			const answer = await Caller.send({
				name: "shopGet",
				args: { shopId: this.shopId }
			});
			const bonus = this.wallet.addReward(answer?.bonusReward);
			if (bonus) console.log(`${NX_LOG_CASH} +${bonus} бонус за открытие лавки, монет ${this.wallet.value}`);
			return this.see(Object.values(answer?.slots ?? {}));
		}
		tell(kind, units, coins) {
			this.session.reporter.unitEvent?.({
				kind,
				units,
				coins
			});
		}
		see(slots) {
			this.view = slots;
			this.pinnedIds.clear();
			for (const slot of slots) if (slot.pinned) this.pinnedIds.add(slot.id);
			this.onChange();
			return slots;
		}
		beforeAction() {
			this.onChange();
			return pause(this.actions++ === 0 ? NX_PACE.firstAction : NX_PACE.betweenActions);
		}
	};
	function nonZeroFragments(fragments) {
		const next = {};
		for (const [id, amount] of Object.entries(fragments ?? {})) if (Number(amount) !== 0) next[id] = amount;
		return next;
	}
	function ownedUnits(fragments) {
		const byAmount = Object.keys(fragments).map(Number).filter((id) => Number(fragments[id]) > 0).sort((a, b) => Number(fragments[b]) - Number(fragments[a]));
		const heroIds = byAmount.filter((id) => id < NX_PET_ID_THRESHOLD);
		return {
			fragments,
			heroIds,
			bestFive: heroIds.slice(0, NX_TEAM_SIZE),
			pets: byAmount.filter((id) => id > NX_PET_ID_THRESHOLD)
		};
	}
	var Attempt = class {
		wallet = new Wallet();
		ledger = new Ledger();
		talismans = [];
		session;
		number;
		point = null;
		live = null;
		eventStall = void 0;
		constructor(session, number) {
			this.session = session;
			this.number = number;
		}
		get stopped() {
			return this.session.stopped;
		}
		get stall() {
			const shopId = stallShopId();
			if (!shopId) return null;
			this.eventStall ??= new Stall(shopId, this.wallet, this.session, () => this.reportUnits());
			this.eventStall.shopId = shopId;
			return this.eventStall;
		}
		progress(text, liveKey = null, important = false) {
			const reporter = this.session.reporter;
			reporter.status?.({
				point: this.point,
				coins: this.wallet.value
			});
			this.reportUnits();
			reporter.line(text, liveKey, important);
		}
		reportUnits() {
			this.session.reporter.units?.({
				owned: this.live ?? {},
				pinned: this.eventStall?.pinned() ?? {}
			});
		}
		setFragments(fragments) {
			const next = nonZeroFragments(fragments);
			if (!this.live) this.live = next;
			else {
				for (const key of Object.keys(this.live)) delete this.live[key];
				Object.assign(this.live, next);
			}
			this.reportUnits();
			return this.live;
		}
		async units() {
			return ownedUnits(this.live ?? this.setFragments((await Caller.send("invasion_getInfo"))?.fragments));
		}
		async takeTalisman(setup, offered) {
			const pick = pickTalisman(setup, offered, this.talismans.length);
			if (!pick) return I18N("NX_REASON_NO_TALISMAN");
			await Caller.send({
				name: "invasion_selectEmblem",
				args: { emblemId: pick }
			});
			this.talismans.push(pick);
			this.progress(I18N("NX_TALISMAN_TAKEN", { name: emblemName(pick) }), null, true);
			return null;
		}
	};
	var NO_HELPER_BASE = class {};
	var searchClasses = null;
	function timerSearchClasses() {
		const Base = WinFixBattle ?? NO_HELPER_BASE;
		if (searchClasses?.Base !== Base) searchClasses = {
			Base,
			PointTimerSearch: declarePointTimerSearch(Base),
			LossTimerSearch: declareLossTimerSearch(Base)
		};
		return searchClasses;
	}
	function createPointTimerSearch(battle, range, report) {
		return new (timerSearchClasses()).PointTimerSearch(battle, range, report);
	}
	function createLossTimerSearch(battle, start, report, range) {
		return new (timerSearchClasses()).LossTimerSearch(battle, start, report, range);
	}
	function declarePointTimerSearch(Base) {
		return class PointTimerSearch extends Base {
			constructor(battle, range, report) {
				super(battle);
				this.isGetTimer = false;
				this.minTimer = range.min;
				this.maxTimer = range.max;
				this.pending = [];
				this.depth = 0;
				this.report = report;
			}
			addLayer() {
				const parts = NX_TIMER_SEARCH_GRID * 2 ** this.depth;
				const step = (this.maxTimer - this.minTimer) / parts;
				const first = this.depth === 0;
				for (let i = first ? 0 : 1; i <= parts; i += first ? 1 : 2) {
					const timer = this.minTimer + i * step + (Math.random() - .5) * step * .5;
					this.pending.push(Math.min(this.maxTimer, Math.max(this.minTimer, timer)));
				}
				this.depth++;
			}
			randTimer() {
				if (this.pending.length === 0) this.addLayer();
				return this.pending.shift();
			}
			showResult() {
				this.report(I18N("NX_TIMER_SEARCH", {
					count: this.count,
					max: this.maxCount
				}));
			}
			checkResult() {
				super.checkResult();
				if (this.bestResult?.count === this.count) this.bestResult.battleTime = this.lastResult?.battleTime;
			}
		};
	}
	function lossTimerQueue(start, range = NX_LOSS_TIMER_RANGE, step = NX_LOSS_TIMER_STEP) {
		const from = Math.min(range.max, Math.max(range.min, Number(start) || range.min));
		const jitter = (t, i) => i === 0 ? t : Math.min(range.max, Math.max(range.min, t + (Math.random() - .5) * step * .5));
		const up = [];
		for (let t = from; t <= range.max + 1e-9; t += step) up.push(t);
		const down = [];
		for (let t = range.min; t < from - 1e-9; t += step) down.push(t);
		return [...up, ...down].map(jitter);
	}
	function nextLossStart(found, range = NX_LOSS_TIMER_RANGE) {
		return Math.max(range.min, Number(found) - NX_LOSS_MEMORY_BACKOFF);
	}
	function declareLossTimerSearch(Base) {
		return class LossTimerSearch extends Base {
			constructor(battle, start, report, range = NX_LOSS_TIMER_RANGE) {
				super(battle);
				this.isGetTimer = false;
				this.minTimer = range.min;
				this.maxTimer = range.max;
				this.pending = lossTimerQueue(start, range);
				this.report = report;
			}
			randTimer() {
				if (this.pending.length === 0) this.exhausted = true;
				return this.pending.length ? this.pending.shift() : this.maxTimer;
			}
			checkResult() {
				if (this.count > 1 && this.lastBattleResult && !this.lastBattleResult.win) this.bestResult = {
					count: this.count,
					timer: this.lastTimer,
					value: 0,
					result: structuredClone(this.lastBattleResult),
					progress: structuredClone(this.lastBattleProgress),
					battleTimer: this.lastResult.battleTimer,
					battleTime: this.lastResult.battleTime
				};
			}
			isEndLoop() {
				return Boolean(this.bestResult?.result) && this.bestResult.result.win === false || this.exhausted || this.count >= this.maxCount || this.endTime < Date.now();
			}
			showResult() {
				this.report(I18N("NX_LOSS_SEARCH", {
					count: this.count,
					max: this.maxCount
				}));
			}
		};
	}
	function lossSkipWait(timer, battleTimer, battleTime) {
		const full = Number(battleTimer);
		const length = Number(battleTime);
		let k = 1 / 1.5;
		if (Number.isFinite(full) && full > 1.5 && Number.isFinite(length) && length > 0) k = (full - 1.5) / length;
		k = Math.min(1 / 1.5, Math.max(.2, k));
		const [min, max] = NX_PACE.autoBattle;
		const wait = Number(timer) * k + 1.5 + (min + Math.random() * (max - min)) / 1e3;
		return Number.isFinite(full) && full > 0 ? Math.min(full, wait) : wait;
	}
	async function waitWithCountdown(startedAt, seconds, onTick) {
		let left = startedAt + Number(seconds) * 1e3 - Date.now();
		while (left > 0) {
			onTick(Math.ceil(left / 1e3));
			const step = Math.min(1e3, left);
			await sleep(step);
			left -= step;
		}
	}
	function defendersSnapshot(battle) {
		const team = battle?.defenders?.[0];
		return {
			units: (Array.isArray(team) ? team : Object.values(team ?? {})).map((u) => ({
				id: u?.id,
				hp: u?.hp,
				state: u?.state
			})),
			effects: battle?.effects?.defenders ?? null
		};
	}
	async function waitBattleTime(startedAt) {
		const [min, max] = NX_PACE.autoBattle;
		const left = startedAt + min + Math.random() * (max - min) - Date.now();
		if (left > 0) await sleep(left);
	}
	async function sendBattleEnd(attempt, missionId, outcome) {
		const call = new Caller([{
			name: "invasion_bossEnd",
			args: {
				id: missionId,
				result: outcome.result,
				progress: outcome.progress
			}
		}, {
			name: "invasion_getInfo",
			args: {}
		}]);
		setIsCancalBattle(false);
		try {
			await call.send();
		} finally {
			setIsCancalBattle(true);
		}
		const end = call.result("invasion_bossEnd");
		const info = call.result("invasion_getInfo");
		const reward = attempt.wallet.addReward(end?.reward);
		if (reward) console.log(`${NX_LOG_CASH} +${reward} награда за бой, монет ${attempt.wallet.value}`);
		const lives = attempt.wallet.addReward(end?.exchangeLivesReward);
		if (lives) console.log(`${NX_LOG_CASH} +${lives} обмен жизней, монет ${attempt.wallet.value}`);
		if (info?.fragments) attempt.setFragments(info.fragments);
		const invalid = Boolean(end?.result?.afterInvalid || call.sideResult("invasion_bossEnd")?.afterInvalid);
		if (invalid) console.error("Сервер не принял результат боя: afterInvalid", end);
		return {
			info,
			invalid
		};
	}
	function secondsText(value) {
		const n = Number(value);
		return Number.isFinite(n) ? n.toFixed(1) : "?";
	}
	async function fightPoint(attempt, missionId, chapterId, heroes, pet, favor, point) {
		try {
			const battle = await Caller.send({
				name: "invasion_bossStart",
				args: {
					id: missionId,
					chapterId,
					heroes,
					pet,
					favor
				}
			});
			const startedAt = Date.now();
			let outcome = await Calc(battle);
			let improvedTimer = 0;
			let story = `автобой выиграл, бой ${secondsText(outcome.battleTime)} с`;
			if (!outcome.result.win) {
				const searchStart = Date.now();
				const search = createPointTimerSearch(battle, NX_BATTLE_TIMER_RANGE, (text) => attempt.progress(text, "timer"));
				const found = await search.start(startedAt + NX_TIMER_SEARCH_BUDGET_MS, NX_TIMER_SEARCH_MAX_TRIES);
				const searched = `перебор ${found.maxCount ?? search.count ?? 0} расчётов за ${secondsText((Date.now() - searchStart) / 1e3)} с`;
				if (found.result?.win) {
					outcome = {
						...outcome,
						result: found.result,
						progress: found.progress
					};
					improvedTimer = found.battleTimer ?? outcome.battleTimer;
					story = `улучшен, победа на таймере ${Number(found.timer).toFixed(2)} с, ${searched}, бой ${secondsText(found.battleTime)} с`;
				} else {
					story = `победы не нашлось, ${searched}, уходит автобой, бой ${secondsText(outcome.battleTime)} с`;
					attempt.progress(I18N("NX_WIN_NOT_FOUND"), "timer", true);
				}
			}
			const improved = Number(improvedTimer) > 0;
			if (improved) await waitWithCountdown(startedAt, Number(improvedTimer), (seconds) => attempt.progress(I18N("NX_WIN_FOUND_WAIT", { seconds }), "timer", true));
			else await waitBattleTime(startedAt);
			const end = await sendBattleEnd(attempt, missionId, outcome);
			if (improved) attempt.progress(I18N("NX_WIN_SENT"), "timer", true);
			const where = point ? `точка ${point}` : `бой ${missionId}`;
			console.log(`${NX_LOG_BATTLE} ${where}: ${story}, отправлен через ${secondsText((Date.now() - startedAt) / 1e3)} с от старта`);
			return {
				error: false,
				...end
			};
		} catch (e) {
			console.error(e);
			return {
				error: true,
				failure: e
			};
		}
	}
	async function loseBattleOnPurpose(attempt, missionId, chapterId, heroes, lossStart = NX_LOSS_TIMER_RANGE.min) {
		try {
			const battle = await Caller.send({
				name: "invasion_bossStart",
				args: {
					id: missionId,
					chapterId,
					heroes,
					favor: {}
				}
			});
			const startedAt = Date.now();
			console.log(`Слив: противник на старте ${JSON.stringify(defendersSnapshot(battle))}`);
			let outcome = await Calc(battle);
			let improvedTimer = 0;
			let lossTimer = null;
			if (outcome.result?.win) {
				const searchStart = Date.now();
				const search = createLossTimerSearch(battle, lossStart, (text) => attempt.progress(text, "timer"));
				const found = await search.start(searchStart + NX_LOSS_SEARCH_BUDGET_MS, NX_LOSS_SEARCH_MAX_TRIES);
				const tries = found.maxCount ?? search.count ?? 0;
				if (found.result && found.result.win === false) {
					outcome = {
						...outcome,
						result: found.result,
						progress: found.progress
					};
					lossTimer = found.timer;
					const fullWait = found.battleTimer ?? outcome.battleTimer;
					improvedTimer = lossSkipWait(lossTimer, fullWait, found.battleTime);
					console.log(`Слив: проигрыш найден на таймере ${Number(lossTimer).toFixed(2)} с, ждём ${improvedTimer.toFixed(1)} с как пропуск после «авто» (весь бой ${fullWait} с), перебор ${tries} расчётов за ${Date.now() - searchStart} мс, начало с ${Number(lossStart).toFixed(1)} с`);
				} else {
					console.log(`Слив: проигрыша не нашлось за ${tries} расчётов и ${Date.now() - searchStart} мс, уходит обычный автобой`);
					attempt.progress(I18N("NX_LOSS_NOT_FOUND"), "timer", true);
				}
			}
			if (lossTimer != null) await waitWithCountdown(startedAt, improvedTimer, (seconds) => attempt.progress(I18N("NX_LOSS_FOUND_WAIT", { seconds }), "timer", true));
			else await waitBattleTime(startedAt);
			const end = await sendBattleEnd(attempt, missionId, outcome);
			if (lossTimer != null) attempt.progress(I18N("NX_LOSS_SENT"), "timer", true);
			console.log("Слив, расчёт вернул", JSON.stringify(outcome.result));
			return {
				calcSaysWin: outcome.result?.win === true,
				lossTimer,
				...end
			};
		} catch (e) {
			console.error(e);
			return { failure: e };
		}
	}
	var RunSession = class {
		stopped = false;
		replaced = false;
		waitingForPlayer = false;
		lossStart = {};
		pointMemory = {};
		carryUnseen = {};
		reporter;
		holds = new Set();
		constructor(reporter) {
			this.reporter = reporter;
		}
		carryNeverOnSale() {
			return Object.entries(this.carryUnseen).filter(([, count]) => count >= NX_CARRY_UNSEEN_LIMIT).map(([id]) => Number(id));
		}
		stop() {
			this.stopped = true;
			console.log("%cArchRank: запрошена остановка", "color: red; font-weight: bold;");
		}
		replace() {
			this.replaced = true;
			this.stop();
			const holds = [...this.holds];
			this.holds.clear();
			for (const hold of holds) hold.release();
		}
		holdWindows() {
			let release = () => {};
			const hold = {
				promise: new Promise((resolve) => release = resolve),
				release
			};
			this.holds.add(hold);
			return () => {
				if (this.holds.delete(hold)) hold.release();
			};
		}
		async notice(text, error) {
			if (this.replaced) return false;
			await this.windowsFree();
			if (this.replaced) return false;
			this.waitingForPlayer = true;
			try {
				await this.reporter.notice(text, error);
			} finally {
				this.waitingForPlayer = false;
			}
			return !this.replaced;
		}
		async askAfterBoss(report) {
			if (this.replaced) return "halt";
			await this.windowsFree();
			if (this.replaced) return "halt";
			this.waitingForPlayer = true;
			let decision;
			try {
				decision = await this.reporter.askAfterBoss(report);
			} finally {
				this.waitingForPlayer = false;
			}
			return this.replaced ? "halt" : decision;
		}
		async windowsFree() {
			while (this.holds.size) await Promise.race([...this.holds].map((hold) => hold.promise));
		}
	};
	function stoppedOutcome() {
		return {
			kind: "retry",
			reason: I18N("NX_REASON_STOPPED")
		};
	}
	function fragmentSellPrice(kind) {
		const settings = currentEvent()?.settings;
		const price = Number(settings?.fragmentSellReward?.[kind]?.coin?.[1080] ?? 0);
		if (price > 0) return price;
		return kind === "hero" ? NX_FRAGMENT_SELL_PRICE : 0;
	}
	function randomLotResale() {
		return NX_RANDOM_LOT_FRAGMENTS * fragmentSellPrice("hero");
	}
	function petLotBaseCost(shopId) {
		let base = 0;
		for (const list of Object.values(shopById(shopId)?.slots ?? {})) for (const lot of list) {
			if (!lot.reward?.invasionFragmentPet) continue;
			const cost = Number(lot.cost?.coin?.[1080] ?? 0);
			if (cost > 0 && (!base || cost < base)) base = cost;
		}
		return base;
	}
	function isDiscountedPetSlot(slot, shopId) {
		if (!slot.reward?.invasionFragmentPet) return false;
		const cost = Number(slot.cost?.coin?.[1080] ?? 0);
		const base = petLotBaseCost(shopId);
		return cost > 0 && base > 0 && cost < base;
	}
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
			if (carryOnly === "rank") need = carryRankNeedFor(setup, fragments, heroId);
			else if (carryOnly) need = carryNeedFor(setup, fragments, heroId);
			else need = Math.max(0, Number(setup.targets[heroId] ?? 0) - have);
			if (need > 0) neededIds.push(heroId);
			useful += Math.min(count, need);
		}
		if (!carryOnly) for (const [id, amount] of Object.entries(petReward)) {
			const petId = Number(id);
			let need = setup.petsToCollect.includes(petId) && Number(fragments[petId] ?? 0) <= 0 ? 1 : 0;
			if (need > 0 && waitPetDiscount && !isDiscountedPetSlot(slot, stallShopId()) && !fullPricePetsAllowed(setup, fragments)) need = 0;
			if (need > 0) neededIds.push(petId);
			useful += Math.min(Number(amount), need);
		}
		const cost = Number(slot.cost?.coin?.[1080] ?? 0);
		const effectiveCost = cost - resale;
		return {
			cost,
			useful,
			effectiveCost,
			neededIds,
			price: useful > 0 ? effectiveCost / useful : Infinity
		};
	}
	function lotUnits(slot) {
		return [...Object.keys(slot.reward?.invasionFragmentHero ?? {}), ...Object.keys(slot.reward?.invasionFragmentPet ?? {})].join("+");
	}
	function usefulSlots(shopSlots, setup, fragments, carryOnly, waitPetDiscount = false) {
		const result = [];
		for (const slot of shopSlots) {
			if (slot.bought) continue;
			if (slot.reward?.invasionFragmentHeroRand) continue;
			const value = slotValue(slot, setup, fragments, carryOnly, waitPetDiscount);
			if (value.useful <= 0 || value.cost <= 0) continue;
			result.push({
				slot,
				...value
			});
		}
		return result;
	}
	function countSources(candidates) {
		const sources = {};
		for (const candidate of candidates) for (const id of candidate.neededIds) sources[id] = (sources[id] ?? 0) + 1;
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
		for (const candidate of pool) if (!best || candidate.price < best.price || candidate.price === best.price && candidate.cost < best.cost) best = candidate;
		if (best) best.isSoleSource = soleSource.includes(best);
		return best;
	}
	async function releasePins(attempt, stall, shopSlots) {
		for (const slot of shopSlots) {
			if (attempt.stopped) break;
			if (!slot.pinned || slot.bought) continue;
			await stall.unpin(slot);
			console.log(`Сняли закреп с ${lotUnits(slot)}, слот ${slot.id}: закупка без закрепов`);
		}
	}
	function showShopping(attempt, setup, fragments, tick = null) {
		const state = collectedState(setup, fragments);
		const text = I18N("NX_SHOPPING", {
			attempt: attempt.number,
			coins: attempt.wallet.value,
			heroes: state.heroesLeft.length,
			pets: state.petsLeft.length
		});
		attempt.progress(tick === null ? text : text + ".".repeat(tick % 3 + 1), "shopping", true);
	}
	async function buyForArchdemonNew(attempt, setup, { discountPets = false, minCoins = null, shopSlots: openedSlots = null, onTalismans = null } = {}) {
		const coins = attempt.wallet;
		const stall = attempt.stall;
		if (!stall) return {
			kind: "done",
			coins: coins.value,
			shown: false
		};
		let shopSlots = openedSlots;
		if (!shopSlots) {
			const visit = await stall.open(onTalismans);
			if (visit.kind === "retry") return {
				kind: "retry",
				coins: coins.value,
				reason: visit.reason
			};
			shopSlots = visit.slots;
		}
		const fragments = (await attempt.units()).fragments;
		let tick = 0;
		let guard = 0;
		let petDeposit = discountPets;
		let pinsReleased = false;
		while (guard < 300) {
			guard++;
			if (attempt.stopped) break;
			if (collectedState(setup, fragments).done) break;
			if (minCoins != null) {
				const resale = extrasResale(setup, fragments);
				const projected = coins.value + resale + NX_MIN_COINS_SLACK;
				if (projected < minCoins) {
					const numbers = {
						coins: coins.value,
						resale,
						slack: NX_MIN_COINS_SLACK,
						projected,
						min: minCoins
					};
					console.log(`${NX_LOG_CASH} граница закупки: ${coins.value} + продажа ${resale} + запас ${NX_MIN_COINS_SLACK} = ${projected} < ${minCoins}, заход заново`);
					if (tick) showShopping(attempt, setup, fragments);
					return {
						kind: "retry",
						coins: coins.value,
						reason: I18N("NX_REASON_MIN_COINS_UNREACHABLE", numbers)
					};
				}
			}
			if (coins.value < NX_MIN_LOT_COST && !petDeposit) break;
			showShopping(attempt, setup, fragments, tick);
			tick++;
			if (await buySlotsForArchdemonNew(attempt, stall, shopSlots, setup, fragments, discountPets)) {
				await sellUnneededFragments(attempt, stall, setup, fragments, false);
				continue;
			}
			if (petDeposit) {
				await buyDiscountedPets(attempt, stall, shopSlots, fragments);
				if (usefulSlots(shopSlots, setup, fragments, false, discountPets).length > 0 || coins.value < NX_MIN_LOT_COST + NX_STALL_REFRESH_COST) {
					petDeposit = false;
					console.log("Монет не хватает, забираем залог: продаём лишних питомцев и дальше их не скупаем");
					if (await sellExtraPets(attempt, stall, setup, fragments) > 0) continue;
				}
			}
			if (coins.value >= NX_MIN_LOT_COST + NX_STALL_REFRESH_COST) {
				if (!pinsReleased) {
					await releasePins(attempt, stall, shopSlots);
					pinsReleased = true;
				}
				const beforeRefresh = coins.value;
				shopSlots = await stall.refresh();
				attempt.ledger.add("обновления лавки", coins.value - beforeRefresh);
				if (!shopSlots) break;
			} else break;
		}
		if (tick && !attempt.stopped) showShopping(attempt, setup, fragments);
		return {
			kind: "done",
			coins: coins.value,
			shown: tick > 0
		};
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
	async function buySlotsForArchdemonNew(attempt, stall, shopSlots, setup, fragments, waitPetDiscount = false) {
		const coins = attempt.wallet;
		let bought = false;
		try {
			let guard = 0;
			while (guard < 60) {
				guard++;
				if (attempt.stopped) break;
				if (collectedState(setup, fragments).done) break;
				const best = pickBestSlot(shopSlots, setup, fragments, coins, false, waitPetDiscount, true);
				if (!best) break;
				await stall.buy(best.slot);
				coins.value -= best.cost;
				attempt.ledger.add("основной пак", -best.cost);
				best.slot.bought = true;
				bought = true;
				applyReward(fragments, best.slot.reward);
				console.log(`${NX_LOG_CASH} -${best.cost} основной пак ${lotUnits(best.slot)}, полезных ${best.useful}, чистая ${best.effectiveCost}, остаток ${coins.value}` + (best.isSoleSource ? ", единственный источник" : ""));
			}
		} catch (e) {
			console.error(e);
			await coins.load();
		}
		return bought;
	}
	async function sellUnneededFragments(attempt, stall, setup, fragments, keepCarry) {
		const coins = attempt.wallet;
		let sold = 0;
		let income = 0;
		for (const [id, count] of Object.entries(fragments)) {
			if (attempt.stopped) break;
			const fragmentId = Number(id);
			const have = Number(count);
			if (have <= 0) continue;
			if (fragmentId >= NX_PET_ID_THRESHOLD) continue;
			if (keepAmountFor(setup, fragmentId, keepCarry) > 0) continue;
			income += await stall.sell(fragments, fragmentId, have);
			sold += have;
			console.log(`Продали героя ${fragmentId} целиком, фрагментов ${have}`);
		}
		if (sold > 0) {
			coins.value += income;
			attempt.ledger.add("продажи", income);
			console.log(`${NX_LOG_CASH} +${income} продажа ${sold} фрагментов, остаток ${coins.value}`);
		}
		return sold;
	}
	async function sellExtraPets(attempt, stall, setup, fragments) {
		const coins = attempt.wallet;
		const extra = Object.entries(fragments).map(([id, count]) => [Number(id), Number(count)]).filter(([id, count]) => id >= NX_PET_ID_THRESHOLD && count > 0 && !setup.petsToCollect.includes(id));
		if (extra.length === 0) return 0;
		let sold = 0;
		let income = 0;
		for (const [petId, count] of extra) {
			if (attempt.stopped) break;
			income += await stall.sell(fragments, petId, count);
			sold += count;
			console.log(`Продали лишнего питомца ${petId}`);
		}
		coins.value += income;
		attempt.ledger.add("продажа питомцев", income);
		console.log(`${NX_LOG_CASH} +${income} продажа ${sold} питомцев, остаток ${coins.value}`);
		return sold;
	}
	async function buyCarryHeroes(attempt, stall, shopSlots, setup, fragments) {
		const coins = attempt.wallet;
		let guard = 0;
		while (guard < 20) {
			guard++;
			if (attempt.stopped) break;
			if (carryPackReady(setup, fragments)) break;
			const best = pickBestSlot(shopSlots, setup, fragments, coins, true);
			if (!best) break;
			await stall.buy(best.slot);
			coins.value -= best.cost;
			attempt.ledger.add("проходные", -best.cost);
			best.slot.bought = true;
			applyReward(fragments, best.slot.reward);
			console.log(`${NX_LOG_CASH} -${best.cost} проходной лот ${Object.keys(best.slot.reward?.invasionFragmentHero ?? {}).join("+")}, полезных ${best.useful}, чистая ${best.effectiveCost}, остаток ${coins.value}`);
		}
	}
	async function buyCarryRanks(attempt, stall, shopSlots, setup, fragments) {
		const coins = attempt.wallet;
		let guard = 0;
		while (guard < 20) {
			guard++;
			if (attempt.stopped) break;
			const best = pickBestSlot(shopSlots, setup, fragments, coins, "rank");
			if (!best) break;
			await stall.buy(best.slot);
			coins.value -= best.cost;
			attempt.ledger.add("проходные до ранга", -best.cost);
			best.slot.bought = true;
			applyReward(fragments, best.slot.reward);
			console.log(`${NX_LOG_CASH} -${best.cost} проходной до ранга ${Object.keys(best.slot.reward?.invasionFragmentHero ?? {}).join("+")}, полезных ${best.useful}, чистая ${best.effectiveCost}, остаток ${coins.value}`);
		}
	}
	async function buySacrificeHero(attempt, stall, shopSlots, setup, fragments) {
		const coins = attempt.wallet;
		if (sacrificeOwned(setup, fragments)) return false;
		let best = null;
		for (const slot of shopSlots) {
			if (slot.bought || slot.reward?.invasionFragmentHeroRand) continue;
			const heroes = slot.reward?.invasionFragmentHero ?? {};
			const heroId = setup.sacrificeHeroes.find((id) => heroes[id]);
			if (!heroId) continue;
			const cost = Number(slot.cost?.coin?.[1080] ?? 0);
			if (!cost || coins.value < cost) continue;
			const effective = cost - Object.entries(heroes).reduce((sum, [id, amount]) => sum + (keepAmountFor(setup, Number(id), true) > 0 ? 0 : Number(amount)), 0) * fragmentSellPrice("hero");
			if (!best || effective < best.effective) best = {
				slot,
				heroId,
				cost,
				effective
			};
		}
		if (!best) return false;
		await stall.buy(best.slot);
		coins.value -= best.cost;
		best.slot.bought = true;
		applyReward(fragments, best.slot.reward);
		attempt.ledger.add("герой для слива", -best.cost);
		console.log(`${NX_LOG_CASH} -${best.cost} герой для слива ${best.heroId}, чистая ${best.effective}, остаток ${coins.value}`);
		return true;
	}
	async function buyCheapLots(attempt, stall, shopSlots, setup, fragments) {
		const coins = attempt.wallet;
		for (const slot of shopSlots) {
			if (attempt.stopped) break;
			if (slot.bought) continue;
			const heroes = slot.reward?.invasionFragmentHero;
			if (!heroes || slot.reward?.invasionFragmentPet) continue;
			const resale = Object.entries(heroes).reduce((sum, [id, amount]) => sum + (keepAmountFor(setup, Number(id), true) > 0 ? 0 : Number(amount)), 0) * fragmentSellPrice("hero");
			const cost = Number(slot.cost?.coin?.[1080] ?? 0);
			if (!cost || cost >= resale || coins.value < cost) continue;
			await stall.buy(slot);
			coins.value -= cost;
			slot.bought = true;
			applyReward(fragments, slot.reward);
			attempt.ledger.add("перепродажа", -cost);
			console.log(`${NX_LOG_CASH} -${cost} на перепродажу ${Object.keys(heroes).join("+")}, вернёт от ${resale}, остаток ${coins.value}`);
		}
	}
	async function buyAllRandomLots(attempt, stall, shopSlots, fragments, buyAny = false) {
		const coins = attempt.wallet;
		const resale = randomLotResale();
		let bought = 0;
		let cheap = 0;
		for (const slot of shopSlots) {
			if (attempt.stopped) break;
			if (slot.bought) continue;
			if (!slot.reward?.invasionFragmentHeroRand) continue;
			const cost = slot.cost?.coin?.[1080];
			if (!cost) continue;
			if (!buyAny && cost >= resale) {
				console.log(`Неизвестная карта за ${cost} пропущена: продажа вернёт ${resale}, это минус`);
				continue;
			}
			if (coins.value < cost) continue;
			const result = await stall.buy(slot);
			coins.value -= cost;
			slot.bought = true;
			bought++;
			if (cost < resale) cheap++;
			attempt.ledger.add("неизвестные карты", -cost);
			applyReward(fragments, result);
			console.log(`${NX_LOG_CASH} -${cost} неизвестная карта ${Object.keys(result?.invasionFragmentHero ?? {}).join("+")}, остаток ${coins.value}`);
		}
		return {
			bought,
			cheap
		};
	}
	function preFinalNeed(setup, fragments, heroId) {
		const carryTarget = setup.carryHeroes?.includes(heroId) ? Number(setup.carryTargets?.[heroId] ?? 1) : 0;
		const need = Math.max(Number(setup.targets[heroId] ?? 0), carryTarget);
		return Math.max(0, need - Number(fragments[heroId] ?? 0));
	}
	function planStallPins(shopSlots, setup, fragments) {
		const remaining = {};
		let sacrificeOpen = sacrificeNeeded(setup, fragments);
		const forSacrifice = (id) => sacrificeOpen && setup.sacrificeHeroes.includes(id);
		const candidates = [];
		for (const slot of shopSlots) {
			if (slot.bought || slot.reward?.invasionFragmentHeroRand) continue;
			const heroes = slot.reward?.invasionFragmentHero;
			if (!heroes) continue;
			const ids = Object.keys(heroes).map(Number);
			for (const id of ids) if (remaining[id] === void 0) remaining[id] = preFinalNeed(setup, fragments, id);
			if (ids.some((id) => remaining[id] > 0 || forSacrifice(id))) candidates.push(slot);
		}
		const heroPrice = fragmentSellPrice("hero");
		const score = (slot) => {
			const heroes = Object.entries(slot.reward.invasionFragmentHero).map(([id, amount]) => [Number(id), Number(amount)]);
			let sacrificePart = heroes.some(([id]) => forSacrifice(id)) && !heroes.some(([id]) => forSacrifice(id) && remaining[id] > 0) ? 1 : 0;
			let useful = 0;
			let resale = 0;
			for (const [heroId, count] of heroes) {
				let part = Math.min(count, remaining[heroId] ?? 0);
				if (sacrificePart && forSacrifice(heroId)) {
					part = 1;
					sacrificePart = 0;
				}
				useful += part;
				if (keepAmountFor(setup, heroId, false) === 0) resale += (count - part) * heroPrice;
			}
			const cost = Number(slot.cost?.coin?.[1080] ?? 0);
			return {
				useful,
				cost,
				price: useful > 0 ? (cost - resale) / useful : Infinity
			};
		};
		const chosen = [];
		for (;;) {
			let best = null;
			for (const slot of candidates) {
				if (chosen.includes(slot)) continue;
				const value = score(slot);
				if (value.useful <= 0) continue;
				const rank = value.useful >= 2 ? 0 : 1;
				if (!best || rank < best.rank || rank === best.rank && (value.price < best.price || value.price === best.price && (value.cost < best.cost || value.cost === best.cost && slot.pinned && !best.slot.pinned))) best = {
					slot,
					rank,
					...value
				};
			}
			if (!best) break;
			chosen.push(best.slot);
			for (const [id, amount] of Object.entries(best.slot.reward.invasionFragmentHero)) {
				const heroId = Number(id);
				remaining[heroId] = Math.max(0, (remaining[heroId] ?? 0) - Number(amount));
				if (setup.sacrificeHeroes.includes(heroId)) sacrificeOpen = false;
			}
		}
		return chosen;
	}
	async function applyStallPins(attempt, stall, shopSlots, setup, fragments) {
		const keep = new Set(planStallPins(shopSlots, setup, fragments));
		const petsOf = (slot) => Object.keys(slot.reward?.invasionFragmentPet ?? {}).map(Number);
		const neededPet = (id) => setup.petsToCollect.includes(id) && !(Number(fragments[id] ?? 0) > 0);
		for (const slot of shopSlots) {
			if (attempt.stopped) return;
			if (!slot.pinned || slot.bought) continue;
			const pets = petsOf(slot);
			const isPetSlot = pets.length > 0 && !slot.reward?.invasionFragmentHero;
			if (isPetSlot ? pets.some(neededPet) : keep.has(slot)) continue;
			await stall.unpin(slot);
			console.log(`Сняли закреп с ${lotUnits(slot)}, слот ${slot.id}: ${isPetSlot ? "питомец не нужен" : "не нужен или есть дешевле"}`);
		}
		for (const slot of keep) {
			if (attempt.stopped) return;
			if (slot.pinned) continue;
			await stall.pin(slot);
			console.log(`Закрепили ${lotUnits(slot)} за ${slot.cost?.coin?.[1080]}, слот ${slot.id}`);
		}
		const pledgedPets = new Set(shopSlots.filter((slot) => slot.pinned && !slot.bought).flatMap(petsOf));
		for (const slot of shopSlots) {
			if (attempt.stopped) return;
			if (slot.bought || slot.pinned || !isDiscountedPetSlot(slot, stall.shopId)) continue;
			const pets = petsOf(slot).filter((id) => neededPet(id) && !pledgedPets.has(id));
			if (pets.length === 0) continue;
			try {
				await stall.pin(slot);
			} catch (e) {
				console.error(e);
				return;
			}
			pets.forEach((id) => pledgedPets.add(id));
			console.log(`Закрепили нужного питомца со скидкой ${pets.join("+")}, слот ${slot.id}`);
		}
	}
	async function buyDiscountedPets(attempt, stall, shopSlots, fragments) {
		const coins = attempt.wallet;
		const sellPrice = fragmentSellPrice("pet");
		let bought = 0;
		for (const slot of shopSlots) {
			if (attempt.stopped) break;
			if (slot.bought || !isDiscountedPetSlot(slot, stall.shopId)) continue;
			const pets = slot.reward.invasionFragmentPet;
			if (Object.keys(pets).every((id) => Number(fragments[Number(id)] ?? 0) > 0)) continue;
			const cost = Number(slot.cost?.coin?.[1080] ?? 0);
			if (coins.value < cost) continue;
			await stall.buy(slot);
			coins.value -= cost;
			slot.bought = true;
			applyReward(fragments, slot.reward);
			attempt.ledger.add("питомцы со скидкой", -cost);
			bought++;
			const count = Object.values(pets).reduce((sum, amount) => sum + Number(amount), 0);
			console.log(`${NX_LOG_CASH} -${cost} питомец со скидкой ${Object.keys(pets).join("+")}, продажа вернёт ${count * sellPrice}, остаток ${coins.value}`);
		}
		return bought;
	}
	async function defaultPointPurchases(attempt, stall, shopSlots, setup, fragments, point) {
		await buyDiscountedPets(attempt, stall, shopSlots, fragments);
		const neededBought = await buySlotsForArchdemonNew(attempt, stall, shopSlots, setup, fragments, false);
		if (point === 1) await buyAllRandomLots(attempt, stall, shopSlots, fragments, true);
		return neededBought;
	}
	async function buyAnyHero(attempt, stall, shopSlots, fragments) {
		const coins = attempt.wallet;
		const heroPrice = fragmentSellPrice("hero");
		let best = null;
		for (const slot of shopSlots) {
			if (slot.bought || slot.reward?.invasionFragmentHeroRand || slot.reward?.invasionFragmentPet) continue;
			const heroes = slot.reward?.invasionFragmentHero;
			if (!heroes) continue;
			const cost = Number(slot.cost?.coin?.[1080] ?? 0);
			if (!cost || coins.value < cost) continue;
			const count = Object.values(heroes).reduce((sum, amount) => sum + Number(amount), 0);
			const net = cost - count * heroPrice;
			if (!best || net < best.net || net === best.net && (count > best.count || count === best.count && cost < best.cost)) best = {
				slot,
				cost,
				count,
				net
			};
		}
		if (!best) return false;
		await stall.buy(best.slot);
		coins.value -= best.cost;
		best.slot.bought = true;
		applyReward(fragments, best.slot.reward);
		attempt.ledger.add("любой герой", -best.cost);
		console.log(`${NX_LOG_CASH} -${best.cost} любой герой ${lotUnits(best.slot)}, чистая ${best.net}, остаток ${coins.value}`);
		return true;
	}
	function extraPetsResale(setup, fragments) {
		let count = 0;
		for (const [id, amount] of Object.entries(fragments)) {
			const petId = Number(id);
			if (petId >= NX_PET_ID_THRESHOLD && Number(amount) > 0 && !setup.petsToCollect.includes(petId)) count += Number(amount);
		}
		return count * fragmentSellPrice("pet");
	}
	async function sellOneExtraPet(attempt, stall, setup, fragments) {
		const coins = attempt.wallet;
		const extra = Object.entries(fragments).map(([id, count]) => [Number(id), Number(count)]).find(([id, count]) => id >= NX_PET_ID_THRESHOLD && count > 0 && !setup.petsToCollect.includes(id));
		if (!extra) return 0;
		const [petId, count] = extra;
		const income = await stall.sell(fragments, petId, count);
		coins.value += income;
		attempt.ledger.add("продажа питомцев", income);
		console.log(`${NX_LOG_CASH} +${income} продали лишнего питомца ${petId}, остаток ${coins.value}`);
		return income;
	}
	async function buyFinalDefault(attempt, stall, shopSlots, setup, fragments) {
		const coins = attempt.wallet;
		let slots = shopSlots;
		await sellUnneededFragments(attempt, stall, setup, fragments, false);
		let tick = 0;
		let guard = 0;
		while (guard < 300) {
			guard++;
			if (attempt.stopped) break;
			if (collectedState(setup, fragments).done) break;
			showShopping(attempt, setup, fragments, tick);
			tick++;
			if (await buySlotsForArchdemonNew(attempt, stall, slots, setup, fragments, false)) {
				await sellUnneededFragments(attempt, stall, setup, fragments, false);
				continue;
			}
			const needed = usefulSlots(slots, setup, fragments, false).sort((a, b) => a.cost - b.cost)[0];
			if (needed && coins.value + extraPetsResale(setup, fragments) >= needed.cost) {
				while (coins.value < needed.cost && await sellOneExtraPet(attempt, stall, setup, fragments) > 0) if (attempt.stopped) break;
				continue;
			}
			if (coins.value < NX_STALL_REFRESH_COST) {
				if (await sellOneExtraPet(attempt, stall, setup, fragments) > 0) continue;
				console.log(`Финал: монет ${coins.value}, на обновление не хватает и продавать некого. Закупка закончена`);
				break;
			}
			const beforeRefresh = coins.value;
			slots = await stall.refresh();
			attempt.ledger.add("обновления лавки", coins.value - beforeRefresh);
			if (!slots) break;
		}
		if (tick && !attempt.stopped) showShopping(attempt, setup, fragments);
		return { coins: coins.value };
	}
	function packOwned(setup, heroIds) {
		return setup.heroes.every((id) => heroIds.includes(id));
	}
	async function buildDefaultTeam(attempt, setup) {
		const have = await attempt.units();
		const heroes = packOwned(setup, have.heroIds) ? setup.heroes : have.bestFive;
		const havePets = have.pets;
		let pet;
		if (havePets.length > 0) pet = havePets.includes(setup.mainPet) ? setup.mainPet : havePets[0];
		const favor = {};
		for (const heroId of heroes) {
			const petId = Number(setup.favor[heroId] ?? 0);
			if (petId > 0 && havePets.includes(petId)) favor[heroId] = petId;
		}
		return {
			heroes,
			pet,
			favor,
			packOwned: packOwned(setup, have.heroIds),
			fragments: have.fragments
		};
	}
	function pointMemoryKey(missionId, team) {
		const heroes = [...team.heroes].sort((a, b) => a - b).map((id) => `${id}:${rankStep(Number(team.fragments[id] ?? 0))}`).join(",");
		const favor = Object.entries(team.favor).sort(([a], [b]) => Number(a) - Number(b)).map(([heroId, petId]) => `${heroId}>${petId}`).join(",");
		return `${missionId}|${heroes}|${team.pet ?? 0}|${favor}`;
	}
	async function defaultShopPhase(attempt, setup, point, missionId) {
		attempt.point = point;
		const stall = attempt.stall;
		if (!stall) return {
			kind: "fatal",
			error: I18N("NX_FAIL_NO_STALL")
		};
		try {
			const opened = await stall.open((offered) => attempt.takeTalisman(setup, offered));
			if (opened.kind === "retry") return {
				kind: "retry",
				reason: opened.reason
			};
			let shopSlots = opened.slots;
			const coins = attempt.wallet;
			const fragments = (await attempt.units()).fragments;
			attempt.progress(I18N("NX_WEALTH_SHOP", {
				attempt: attempt.number,
				point,
				coins: coins.value
			}));
			if (!await defaultPointPurchases(attempt, stall, shopSlots, setup, fragments, point) && !collectedState(setup, fragments).done) {
				const team = await buildDefaultTeam(attempt, setup);
				if (attempt.session.pointMemory[pointMemoryKey(missionId, team)] === "won") console.log(`Точка ${point}: этот состав её уже брал, нужных в лавке нет — без обновления`);
				else if (coins.value >= NX_STALL_REFRESH_COST + NX_MIN_LOT_COST) {
					const beforeRefresh = coins.value;
					const refreshed = await stall.refresh();
					attempt.ledger.add("обновления лавки", coins.value - beforeRefresh);
					if (refreshed) {
						shopSlots = refreshed;
						await defaultPointPurchases(attempt, stall, shopSlots, setup, fragments, point);
					}
				}
			}
			return {
				kind: "open",
				stall,
				shopSlots
			};
		} catch (e) {
			console.error(e);
			return {
				kind: "fatal",
				error: e
			};
		}
	}
	async function runArchdemonNewChapterDefault(attempt, setup) {
		attempt.progress(I18N("NX_ENTERING", { attempt: attempt.number }));
		await sleep(3e3);
		if (attempt.stopped) return stoppedOutcome();
		let chapterInfo;
		try {
			chapterInfo = await Caller.send({
				name: "invasion_setActiveChapter",
				args: { chapterId: setup.chapterId }
			});
		} catch (e) {
			console.error(e);
			return {
				kind: "fatal",
				error: e
			};
		}
		attempt.setFragments(chapterInfo.invasion.fragments);
		await attempt.wallet.onChapterEntry(chapterInfo, attempt.number > 1);
		attempt.ledger.reset(attempt.wallet.value);
		const actions = Object.values(chapterInfo.invasion.actions);
		const lastPoint = actions.length - 1;
		await pause(NX_PACE.chapterEnter);
		for (let point = 1; point <= lastPoint; point++) {
			attempt.point = point;
			if (attempt.stopped) return stoppedOutcome();
			const missionId = actions[point - 1]?.payload?.id;
			if (!missionId) return {
				kind: "retry",
				reason: I18N("NX_REASON_NO_MISSIONS")
			};
			if (point > 1) await pause(NX_PACE.afterBattle);
			const visit = await defaultShopPhase(attempt, setup, point, missionId);
			if (visit.kind === "fatal") return {
				kind: "fatal",
				error: visit.error
			};
			if (visit.kind === "retry") return {
				kind: "retry",
				reason: visit.reason
			};
			if (attempt.stopped) return stoppedOutcome();
			let team = await buildDefaultTeam(attempt, setup);
			let key = pointMemoryKey(missionId, team);
			if (attempt.session.pointMemory[key] === "lost") {
				if (!(!team.packOwned && await buyAnyHero(attempt, visit.stall, visit.shopSlots, team.fragments))) {
					console.log(`Точка ${point}: этот состав её уже не брал, поменять его нечем — новый заход без боя`);
					return {
						kind: "retry",
						reason: I18N("NX_REASON_POINT_KNOWN_LOSS", { point })
					};
				}
				team = await buildDefaultTeam(attempt, setup);
				key = pointMemoryKey(missionId, team);
			}
			if (team.packOwned) await sellUnneededFragments(attempt, visit.stall, setup, team.fragments, false);
			attempt.progress(I18N("NX_MISSION", {
				attempt: attempt.number,
				missionNumber: point
			}), null, true);
			await pause(NX_PACE.beforeBattle);
			const fight = await fightPoint(attempt, missionId, setup.chapterId, team.heroes, team.pet, team.favor, point);
			if (fight.error) return {
				kind: "fatal",
				error: fight.failure
			};
			if (!fight.info) return {
				kind: "fatal",
				error: I18N("NX_FAIL_NO_STATE")
			};
			if (fight.invalid) return {
				kind: "fatal",
				message: I18N("NX_ERR_RESULT_INVALID")
			};
			const passed = Object.values(fight.info.actions ?? {}).find((e) => e.payload.id === missionId);
			if (!passed || Number(passed.payload.wins ?? 0) === 0) {
				attempt.session.pointMemory[key] = "lost";
				console.log(`%c${NX_LOG_BATTLE} точка ${point} ПРОИГРАНА, запомнили состав`, "color: red; font-weight: bold;", "\n  герои: " + team.heroes.map((id) => `${unitLabel(id)} ${Number(team.fragments[id] ?? 0)}`).join(", "), "\n  питомец: " + (team.pet ? unitLabel(team.pet) : "нет"));
				return {
					kind: "retry",
					reason: I18N("NX_REASON_POINT_LOST_REMEMBERED", { point })
				};
			}
			attempt.session.pointMemory[key] = "won";
			attempt.progress(I18N("NX_POINT_TAKEN", { point }), null, true);
			if (attempt.stopped) return stoppedOutcome();
		}
		await pause(NX_PACE.afterBattle);
		if (attempt.stopped) return stoppedOutcome();
		attempt.point = lastPoint + 1;
		const stall = attempt.stall;
		if (!stall) return {
			kind: "fatal",
			error: I18N("NX_FAIL_NO_STALL")
		};
		try {
			const finalVisit = await stall.open((offered) => attempt.takeTalisman(setup, offered));
			if (finalVisit.kind === "retry") return {
				kind: "retry",
				reason: finalVisit.reason
			};
			attempt.progress(I18N("NX_DEFAULT_FINAL", { attempt: attempt.number }), null, true);
			const fragments = (await attempt.units()).fragments;
			await buyFinalDefault(attempt, stall, finalVisit.slots, setup, fragments);
		} catch (e) {
			console.error(e);
			return {
				kind: "fatal",
				error: e
			};
		}
		if (attempt.stopped) return stoppedOutcome();
		const result = checkArchdemonNewConditions(setup, attempt.wallet.value, (await attempt.units()).fragments);
		if (result.kind === "retry" && result.missing && setup.stopIfIncomplete) return {
			kind: "incomplete",
			missing: result.missing
		};
		return result;
	}
	async function wealthShopPhase(attempt, setup, point, sacrificePoint = 0) {
		attempt.point = point;
		const stall = attempt.stall;
		if (!stall) return {
			kind: "fatal",
			error: I18N("NX_FAIL_NO_STALL")
		};
		try {
			const opened = await stall.open((offered) => attempt.takeTalisman(setup, offered));
			if (opened.kind === "retry") return {
				kind: "retry",
				reason: opened.reason
			};
			let shopSlots = opened.slots;
			const coins = attempt.wallet;
			const coinsOnEntry = coins.value;
			const fragments = (await attempt.units()).fragments;
			attempt.progress(I18N("NX_WEALTH_SHOP", {
				attempt: attempt.number,
				point,
				coins: coins.value
			}));
			if (point !== 1) {
				await buyCarryRanks(attempt, stall, shopSlots, setup, fragments);
				await buyCheapLots(attempt, stall, shopSlots, setup, fragments);
				await sellUnneededFragments(attempt, stall, setup, fragments, true);
				await applyStallPins(attempt, stall, shopSlots, setup, fragments);
				if (point === sacrificePoint) {
					const found = await ensureSacrificeHero(attempt, stall, setup, shopSlots, fragments);
					if (found.kind !== "done") return found;
				}
				return {
					kind: "done",
					coins: coins.value,
					coinsOnEntry
				};
			}
			const missingMain = () => setup.carryHeroes.filter((id) => Number(fragments[id] ?? 0) <= 0);
			const seen = new Set();
			const look = (slots) => {
				for (const slot of slots) for (const id of Object.keys(slot.reward?.invasionFragmentHero ?? {})) seen.add(Number(id));
			};
			look(shopSlots);
			const needExtra = () => (setup.carryExtraHeroes ?? []).length > 0 && !carryExtraOwned(setup, fragments);
			let refreshes = 0;
			let budgetLeft = Number(setup.startRefreshes ?? 0);
			console.log(`Точка 1: старт, монет ${coins.value}, ищем проходных ${setup.carryHeroes.join(", ")}`);
			while (refreshes <= NX_POINT1_MAX_REFRESHES) {
				if (attempt.stopped) break;
				const passStartCoins = coins.value;
				await buyCarryHeroes(attempt, stall, shopSlots, setup, fragments);
				if (carryPackReady(setup, fragments)) await buyCarryRanks(attempt, stall, shopSlots, setup, fragments);
				await buyCheapLots(attempt, stall, shopSlots, setup, fragments);
				const random = setup.skipRandomLots ? {
					bought: 0,
					cheap: 0
				} : await buyAllRandomLots(attempt, stall, shopSlots, fragments, setup.buyAnyRandomLots === true);
				await sellUnneededFragments(attempt, stall, setup, fragments, true);
				await applyStallPins(attempt, stall, shopSlots, setup, fragments);
				console.log(`${NX_LOG_CASH} ИТОГ круга ${refreshes + 1}: было ${passStartCoins}, стало ${coins.value}, разница ${coins.value - passStartCoins}, неизвестных взято ${random.bought}, из них дешевле ${randomLotResale()}: ${random.cheap}`);
				if (carryPackReady(setup, fragments)) break;
				let fromBudget = false;
				if (random.cheap < NX_LOTS_PER_EARNED_REFRESH) {
					if (budgetLeft <= 0) {
						console.log(`Точка 1: за круг взято неизвестных карт дешевле ${randomLotResale()}: ${random.cheap}, для обновления нужно ${NX_LOTS_PER_EARNED_REFRESH}, запас пуст. Круг закончен, монет ${coins.value}`);
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
				console.log(`Точка 1: обновление ${refreshes} ${fromBudget ? "из запаса, осталось " + budgetLeft : "заработано"}`);
				attempt.progress(I18N("NX_POINT1_REFRESH", {
					attempt: attempt.number,
					refreshes,
					bought: random.cheap,
					coins: coins.value
				}), null, true);
				const beforeRefresh = coins.value;
				const refreshed = await stall.refresh();
				attempt.ledger.add("обновления лавки", coins.value - beforeRefresh);
				if (!refreshed) break;
				shopSlots = refreshed;
				look(shopSlots);
			}
			countUnseenCarry(attempt.session, setup, fragments, seen);
			if (missingMain().length > 0) return {
				kind: "retry",
				reason: I18N("NX_REASON_NO_CARRY", { list: missingMain().map(unitLabel).join(", ") })
			};
			if (needExtra()) return {
				kind: "retry",
				reason: I18N("NX_REASON_NO_CARRY_EXTRA", { list: (setup.carryExtraHeroes ?? []).map(unitLabel).join(", ") })
			};
			console.log(`Точка 1: проходные собраны, обновлений потрачено ${refreshes}`);
			return {
				kind: "done",
				coins: coins.value,
				coinsOnEntry
			};
		} catch (e) {
			console.error(e);
			return {
				kind: "fatal",
				error: e
			};
		}
	}
	function countUnseenCarry(session, setup, fragments, seen) {
		for (const id of setup.carryHeroes) session.carryUnseen[id] = Number(fragments[id] ?? 0) > 0 || seen.has(id) ? 0 : (session.carryUnseen[id] ?? 0) + 1;
	}
	async function ensureSacrificeHero(attempt, stall, setup, visibleSlots, fragments) {
		const coins = attempt.wallet;
		if (setup.sacrificeHeroes.length === 0 || sacrificeOwned(setup, fragments)) return { kind: "done" };
		let shopSlots = visibleSlots;
		try {
			const limit = Number(setup.sacrificeRefreshes ?? 0);
			let refreshes = 0;
			for (;;) {
				if (attempt.stopped) return { kind: "done" };
				if (await buySacrificeHero(attempt, stall, shopSlots, setup, fragments)) {
					await sellUnneededFragments(attempt, stall, setup, fragments, true);
					console.log(`Герой для слива куплен, обновлений потрачено ${refreshes}`);
					return { kind: "done" };
				}
				if (refreshes >= limit || coins.value < NX_STALL_REFRESH_COST + NX_MIN_LOT_COST) break;
				refreshes++;
				attempt.progress(I18N("NX_SACRIFICE_REFRESH", {
					attempt: attempt.number,
					refreshes,
					max: limit
				}), null, true);
				await applyStallPins(attempt, stall, shopSlots, setup, fragments);
				const beforeRefresh = coins.value;
				const refreshed = await stall.refresh();
				attempt.ledger.add("обновления лавки", coins.value - beforeRefresh);
				if (!refreshed) break;
				shopSlots = refreshed;
			}
			console.log(`Героя для слива ${setup.sacrificeHeroes.join(", ")} нет в лавке, обновлений потрачено ${refreshes} из ${limit}`);
			return {
				kind: "retry",
				reason: I18N("NX_REASON_NO_SACRIFICE", { list: setup.sacrificeHeroes.map(unitLabel).join(", ") })
			};
		} catch (e) {
			console.error(e);
			return {
				kind: "fatal",
				error: e
			};
		}
	}
	async function wealthFinalShopping(attempt, stall, setup, shopSlots) {
		try {
			const fragments = (await attempt.units()).fragments;
			attempt.progress(I18N("NX_WEALTH_FINAL", { attempt: attempt.number }), null, true);
			await sellUnneededFragments(attempt, stall, setup, fragments, false);
			const shopping = await buyForArchdemonNew(attempt, setup, {
				discountPets: true,
				minCoins: setup.minCoins ?? null,
				shopSlots
			});
			if (shopping.kind === "retry") return {
				kind: "retry",
				reason: shopping.reason
			};
			await sellUnneededFragments(attempt, stall, setup, fragments, false);
			await sellExtraPets(attempt, stall, setup, fragments);
			if (shopping.shown && !attempt.stopped) showShopping(attempt, setup, fragments);
			console.log(`Финальная закупка закончена, монет осталось ${attempt.wallet.value}`);
			return { kind: "done" };
		} catch (e) {
			console.error(e);
			return {
				kind: "fatal",
				error: e
			};
		}
	}
	async function spendExtraCoins(attempt, setup) {
		const target = Number(setup.presetPercent ?? 0);
		if (!target || setup.keepExtraCoins !== false) return { kind: "done" };
		const fragments = (await attempt.units()).fragments;
		if (!collectedState(setup, fragments).done) return { kind: "done" };
		const stall = attempt.stall;
		if (!stall) return {
			kind: "fatal",
			error: I18N("NX_FAIL_NO_STALL")
		};
		const wallet = attempt.wallet;
		const startCoins = wallet.value;
		let refreshes = 0;
		const spendLine = () => I18N("NX_SPEND_EXTRA", {
			attempt: attempt.number,
			coins: wallet.value,
			percent: coinsToPercent(wallet.value),
			target
		});
		let shown = false;
		try {
			while (coinsToPercent(wallet.value) > target && wallet.value >= NX_STALL_REFRESH_COST) {
				if (attempt.stopped) break;
				if (coinsToPercent(wallet.value - NX_STALL_REFRESH_COST) < target) break;
				attempt.progress(spendLine(), "spend", true);
				shown = true;
				const before = wallet.value;
				const refreshed = await stall.refresh();
				attempt.ledger.add("трата лишних монет", wallet.value - before);
				if (!refreshed) break;
				refreshes++;
			}
		} catch (e) {
			console.error(e);
			return {
				kind: "fatal",
				error: e
			};
		}
		if (shown && !attempt.stopped) attempt.progress(spendLine(), "spend", true);
		if (refreshes) console.log(`${NX_LOG_CASH} лишние монеты: было ${startCoins} (${coinsToPercent(startCoins)}%), обновлений ${refreshes}, стало ${wallet.value} (${coinsToPercent(wallet.value)}%), у автора ${target}%`);
		return { kind: "done" };
	}
	async function buildCarryTeam(attempt, setup) {
		const have = await attempt.units();
		let heroes = setup.carryHeroes.filter((id) => have.heroIds.includes(id));
		const extra = (setup.carryExtraHeroes ?? []).find((id) => have.heroIds.includes(id));
		if (extra !== void 0) heroes = [...heroes, extra];
		if (heroes.length === 0) heroes = have.bestFive;
		const havePets = have.pets;
		let pet;
		if (havePets.length > 0) pet = havePets.includes(setup.mainPet) ? setup.mainPet : havePets[0];
		const favor = {};
		for (const heroId of heroes) {
			const petId = Number(setup.favor[heroId] ?? 0);
			if (petId > 0 && havePets.includes(petId)) favor[heroId] = petId;
		}
		return {
			heroes,
			pet,
			favor
		};
	}
	async function showAfterBossReport(attempt, setup, slots) {
		const coins = attempt.wallet.value;
		console.log(`${NX_LOG_CASH} баланс, отчёт перед Архидемоном: ${coins}`);
		const pinnedLines = [];
		for (const slot of slots ?? []) {
			if (!slot.pinned) continue;
			const ids = Object.keys(slot.reward?.invasionFragmentHero ?? {}).map(Number);
			const cost = slot.cost?.coin?.[1080] ?? "?";
			pinnedLines.push(`${ids.map(unitLabel).join(" + ")} — ${cost}`);
		}
		const fragments = (await attempt.units()).fragments;
		const heroLines = setup.heroes.map((id) => `${unitLabel(id)}: ${Number(fragments[id] ?? 0)} из ${setup.targets[id]}`);
		const petLines = setup.petsToCollect.map((id) => `${unitLabel(id)}: ${Number(fragments[id] ?? 0) > 0 ? "есть" : "нет"}`);
		const carryLines = setup.carryHeroes.map((id) => `${unitLabel(id)}: ${Number(fragments[id] ?? 0)} из ${Number(setup.carryTargets?.[id] ?? 1)}`);
		const books = attempt.ledger.summary(coins);
		const bookLines = [
			`старт захода: ${books.start}`,
			...books.entries.map(([name, value]) => `${name}: ${value > 0 ? "+" : ""}${value}`),
			`итого мои движения: ${books.mine > 0 ? "+" : ""}${books.mine}`,
			`приход с точек: +${books.fromPoints}`
		];
		console.log(`${NX_LOG_CASH} СВОД`, books);
		console.log("Отчёт перед Архидемоном", {
			coins,
			pinned: pinnedLines,
			heroLines,
			petLines,
			carryLines
		});
		return { decision: await attempt.session.askAfterBoss({
			attempt: attempt.number,
			coins,
			bookLines,
			pinnedLines,
			heroLines,
			petLines,
			carryLines
		}) };
	}
	function currentSacrificePoint(setup, lastPoint) {
		return Math.min(lastPoint, Math.max(1, Number(setup.sacrificePoint ?? lastPoint) || lastPoint));
	}
	async function runArchdemonNewChapterWealth(attempt, setup) {
		attempt.progress(I18N("NX_ENTERING", { attempt: attempt.number }));
		await sleep(3e3);
		if (attempt.stopped) return stoppedOutcome();
		let chapterInfo;
		try {
			chapterInfo = await Caller.send({
				name: "invasion_setActiveChapter",
				args: { chapterId: setup.chapterId }
			});
			attempt.setFragments(chapterInfo.invasion.fragments);
			await attempt.wallet.onChapterEntry(chapterInfo, attempt.number > 1);
		} catch (e) {
			console.error(e);
			return {
				kind: "fatal",
				error: e
			};
		}
		const actions = Object.values(chapterInfo.invasion.actions);
		let lives = chapterInfo.invasion.lives;
		attempt.ledger.reset(attempt.wallet.value);
		console.log(`${NX_LOG_CASH} СТАРТ захода ${attempt.number}: ${attempt.ledger.startCoins} монет, жизней ${lives}, сборка расширения ${GM_info.script.version}`);
		const lastPoint = actions.length - 1;
		const sacrificePoint = currentSacrificePoint(setup, lastPoint);
		await pause(NX_PACE.chapterEnter);
		let visit = await wealthShopPhase(attempt, setup, 1, sacrificePoint);
		if (visit.kind === "fatal") return {
			kind: "fatal",
			error: visit.error
		};
		if (visit.kind === "retry") return {
			kind: "retry",
			reason: visit.reason
		};
		for (let point = 1; point <= lastPoint; point++) {
			attempt.point = point;
			if (attempt.stopped) return stoppedOutcome();
			const action = actions[point - 1];
			if (!action) return {
				kind: "retry",
				reason: I18N("NX_REASON_NO_MISSIONS")
			};
			const missionId = action.payload.id;
			if (point === sacrificePoint) {
				const sacrificeHero = pickSacrificeHero(setup, (await attempt.units()).fragments);
				if (!sacrificeHero) return {
					kind: "retry",
					reason: I18N("NX_REASON_NO_SACRIFICE", { list: setup.sacrificeHeroes.map(unitLabel).join(", ") })
				};
				const sacrificeTeam = [sacrificeHero];
				console.log(`Сливаем точку составом ${sacrificeTeam.join(", ")}`);
				for (let number = 1; number <= NX_SACRIFICE_LOSSES; number++) {
					if (attempt.stopped) return stoppedOutcome();
					attempt.progress(I18N("NX_SACRIFICE", {
						attempt: attempt.number,
						number,
						total: NX_SACRIFICE_LOSSES
					}), null, true);
					await pause(NX_PACE.beforeBattle);
					const coinsBeforeLoss = visit.coins;
					const teamKey = sacrificeTeam.join("+");
					const loss = await loseBattleOnPurpose(attempt, missionId, setup.chapterId, sacrificeTeam, attempt.session.lossStart[teamKey]);
					if (loss.lossTimer != null) attempt.session.lossStart[teamKey] = nextLossStart(loss.lossTimer);
					if (!loss.info) return {
						kind: "fatal",
						error: "failure" in loss ? loss.failure : I18N("NX_FAIL_NO_STATE")
					};
					if (loss.invalid) return {
						kind: "fatal",
						message: I18N("NX_ERR_RESULT_INVALID")
					};
					const calcSaysWin = loss.calcSaysWin;
					const afterLoss = loss.info;
					lives = afterLoss.lives;
					const pointState = Object.values(afterLoss.actions).find((e) => e.payload.id === missionId);
					const pointTaken = pointState ? Number(pointState.payload.wins ?? 0) > 0 : false;
					console.log(`Слив ${number} из ${NX_SACRIFICE_LOSSES}: расчёт ${calcSaysWin ? "победа" : "поражение"}, точка ${pointTaken ? "ВЗЯТА" : "не взята"}, жизней ${lives}`);
					if (pointTaken) return {
						kind: "retry",
						reason: I18N("NX_REASON_SACRIFICE_WON")
					};
					if (lives === 0) return {
						kind: "retry",
						reason: I18N("NX_REASON_NO_LIVES")
					};
					await pause(NX_PACE.afterBattle);
					visit = await wealthShopPhase(attempt, setup, point, sacrificePoint);
					if (visit.kind === "fatal") return {
						kind: "fatal",
						error: visit.error
					};
					if (visit.kind === "retry") return {
						kind: "retry",
						reason: visit.reason
					};
					console.log(`${NX_LOG_CASH} слив ${number}: было ${coinsBeforeLoss}, на входе в лавку ${visit.coinsOnEntry}, прирост ${visit.coinsOnEntry - coinsBeforeLoss}`);
				}
			}
			attempt.progress(I18N("NX_MISSION", {
				attempt: attempt.number,
				missionNumber: point
			}), null, true);
			await pause(NX_PACE.beforeBattle);
			const team = await buildCarryTeam(attempt, setup);
			const fragmentsOwned = { ...(await attempt.units()).fragments };
			const coinsBeforePoint = visit.coins;
			const fight = await fightPoint(attempt, missionId, setup.chapterId, team.heroes, team.pet, team.favor, point);
			if (fight.error) return {
				kind: "fatal",
				error: fight.failure
			};
			if (!fight.info) return {
				kind: "fatal",
				error: I18N("NX_FAIL_NO_STATE")
			};
			if (fight.invalid) return {
				kind: "fatal",
				message: I18N("NX_ERR_RESULT_INVALID")
			};
			const info = fight.info;
			lives = info.lives;
			const passed = Object.values(info.actions).find((e) => e.payload.id === missionId);
			console.log(`Точка ${point}, состояние от сервера:`, JSON.stringify(passed?.payload ?? null));
			if (passed && Number(passed.payload.wins ?? 0) === 0) {
				console.log(`%c${NX_LOG_BATTLE} точка ${point} ПРОИГРАНА`, "color: red; font-weight: bold;", "\n  герои: " + (team.heroes.length ? team.heroes.map(unitLabel).join(", ") : "пусто"), "\n  питомец: " + (team.pet ? unitLabel(team.pet) : "нет"), "\n  покровительство: " + (Object.keys(team.favor).length ? Object.entries(team.favor).map(([heroId, petId]) => `${unitLabel(heroId)} -> ${unitLabel(petId)}`).join("; ") : "нет"), "\n  фрагменты состава: " + team.heroes.map((id) => `${unitLabel(id)} ${Number(fragmentsOwned[id] ?? 0)}`).join(", "));
				return {
					kind: "retry",
					reason: I18N("NX_REASON_POINT_LOST", { point })
				};
			}
			if (passed) attempt.progress(I18N("NX_POINT_TAKEN", { point }), null, true);
			if (lives === 0) return {
				kind: "retry",
				reason: I18N("NX_REASON_NO_LIVES")
			};
			if (attempt.stopped) return stoppedOutcome();
			if (point < lastPoint) {
				await pause(NX_PACE.afterBattle);
				visit = await wealthShopPhase(attempt, setup, point + 1, sacrificePoint);
				if (visit.kind === "fatal") return {
					kind: "fatal",
					error: visit.error
				};
				if (visit.kind === "retry") return {
					kind: "retry",
					reason: visit.reason
				};
				console.log(`${NX_LOG_CASH} точка ${point}: было ${coinsBeforePoint}, на входе в лавку ${visit.coinsOnEntry}, прирост ${visit.coinsOnEntry - coinsBeforePoint}`);
			}
		}
		await pause(NX_PACE.afterBattle);
		if (attempt.stopped) return stoppedOutcome();
		attempt.point = lastPoint + 1;
		const stall = attempt.stall;
		if (!stall) return {
			kind: "fatal",
			error: I18N("NX_FAIL_NO_STALL")
		};
		let finalVisit;
		try {
			finalVisit = await stall.open((offered) => attempt.takeTalisman(setup, offered));
		} catch (e) {
			console.error(e);
			return {
				kind: "fatal",
				error: e
			};
		}
		if (finalVisit.kind === "retry") return {
			kind: "retry",
			reason: finalVisit.reason
		};
		if (setup.pauseAfterBoss) {
			if ((await showAfterBossReport(attempt, setup, finalVisit.slots)).decision !== "continue") {
				attempt.session.stop();
				return {
					kind: "halted",
					reason: I18N("NX_REASON_STOPPED")
				};
			}
		}
		const finalOutcome = await wealthFinalShopping(attempt, stall, setup, finalVisit.slots);
		if (finalOutcome.kind === "fatal") return {
			kind: "fatal",
			error: finalOutcome.error
		};
		if (finalOutcome.kind === "retry") return {
			kind: "retry",
			reason: finalOutcome.reason
		};
		if (attempt.stopped) return stoppedOutcome();
		const spent = await spendExtraCoins(attempt, setup);
		if (spent.kind === "fatal") return {
			kind: "fatal",
			error: spent.error
		};
		if (attempt.stopped) return stoppedOutcome();
		return checkArchdemonNewConditions(setup, attempt.wallet.value, (await attempt.units()).fragments);
	}
	async function runArchdemonNewChapter(attempt, setup) {
		if (setup.talismanId === NX_WEALTH_TALISMAN_ID) return await runArchdemonNewChapterWealth(attempt, setup);
		return await runArchdemonNewChapterDefault(attempt, setup);
	}
	async function runArchdemonNewLoop(session, setup) {
		const reporter = session.reporter;
		reporter.open(() => session.stop());
		reporter.plan?.(progressPlan(setup));
		try {
			return await runLoopAttempts(session, setup);
		} finally {
			reporter.close();
		}
	}
	async function runLoopAttempts(session, setup) {
		const reporter = session.reporter;
		let attempt = 0;
		let lastFailure = null;
		while (!session.stopped) {
			attempt++;
			if (chapterEndsAt(setup.chapterId) - Date.now() < NX_EVENT_END_MARGIN_MINUTES * 6e4) {
				if (await session.notice(I18N("NX_EVENT_ENDING", { minutes: NX_EVENT_END_MARGIN_MINUTES }))) syncGame();
				return;
			}
			if (isPaidChapter(setup.chapterId)) {
				if (await session.notice(I18N("NX_ERR_PAID_CHAPTER"))) syncGame();
				return;
			}
			reporter.attemptStart(attempt, lastFailure);
			const outcome = await runArchdemonNewChapter(new Attempt(session, attempt), setup);
			if (outcome.kind === "halted") {
				if (await session.notice(I18N("NX_HALTED_SYNC"))) syncGame();
				return;
			}
			if (outcome.kind === "fatal") {
				if (await session.notice(outcome.message ?? I18N("NX_FAILED", { version: GM_info.script.version }), outcome.error)) syncGame();
				return;
			}
			if (outcome.kind === "ready") {
				if (await session.notice(I18N("NX_READY", {
					attempt,
					coins: outcome.coins,
					percent: outcome.percent
				}))) syncGame();
				return;
			}
			if (outcome.kind === "incomplete") {
				if (await session.notice(I18N("NX_INCOMPLETE", {
					attempt,
					list: outcome.missing
				}))) syncGame();
				return;
			}
			if (session.stopped) break;
			const neverOnSale = session.carryNeverOnSale();
			if (neverOnSale.length > 0) {
				const list = neverOnSale.map(unitLabel).join(", ");
				if (await session.notice(I18N("NX_CARRY_NEVER_ON_SALE", {
					list,
					attempts: NX_CARRY_UNSEEN_LIMIT
				}))) syncGame();
				return;
			}
			reporter.fail(I18N("NX_RETRY", {
				attempt,
				reason: outcome.reason
			}));
			lastFailure = {
				attempt,
				reason: outcome.reason
			};
			await sleep(2500);
			if (session.stopped) break;
			try {
				await Caller.send("invasion_resetChapter");
				const pause = NX_RUN_PAUSE_MIN_SECONDS + Math.random() * (NX_RUN_PAUSE_MAX_SECONDS - NX_RUN_PAUSE_MIN_SECONDS);
				if (!await reporter.countdown(pause, () => session.stopped)) break;
			} catch (e) {
				console.error(e);
				if (await session.notice(I18N("NX_FAILED", { version: GM_info.script.version }), e)) syncGame();
				return;
			}
		}
		if (await session.notice(I18N("NX_STOPPED", { attempt }))) syncGame();
	}
	function openCache() {
		return new Promise((resolve) => {
			let request;
			try {
				request = indexedDB.open("hw_cache");
			} catch {
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
			} catch {
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
			} catch {
				db.close();
				resolve(keys);
			}
		});
	}
	var hashedPaths = null;
	var HASHED = /^(.+)\.[0-9a-f]{16,}(\.[A-Za-z0-9]+)$/;
	function gameIndex() {
		return (typeof selfGame !== "undefined" && selfGame ? selfGame["game.assets.storage.AssetStorage"] : null)?.instance?.index ?? null;
	}
	function buildHashedPaths() {
		const found = new Map();
		const index = gameIndex();
		if (!index) return found;
		const seen = new Set();
		const walk = (node, depth) => {
			if (!node || typeof node !== "object" || seen.has(node) || depth > 6) return;
			seen.add(node);
			for (const value of Object.values(node)) if (typeof value === "string") {
				const m = HASHED.exec(value);
				if (m) found.set(m[1] + m[2], value);
			} else if (value && typeof value === "object") walk(value, depth + 1);
		};
		try {
			walk(index, 0);
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
					resolve({
						base: url.slice(0, at),
						query
					});
				};
				cursor.onerror = () => {
					db.close();
					resolve(null);
				};
			} catch {
				db.close();
				resolve(null);
			}
		});
	}
	var fileNames;
	function findFileNames() {
		const index = gameIndex();
		if (!index) return void 0;
		const isName = (key) => /^[\w.-]+\.[A-Za-z0-9]+$/.test(key);
		const seen = new Set();
		const find = (node, depth) => {
			if (!node || typeof node !== "object" || seen.has(node) || depth > 4) return null;
			seen.add(node);
			const keys = Object.keys(node);
			if (keys.length > 1e3 && keys.slice(0, 200).filter(isName).length > 100) return node;
			for (const key of keys.slice(0, 50)) {
				const found = find(node[key], depth + 1);
				if (found) return found;
			}
			return null;
		};
		try {
			return find(index, 0);
		} catch (e) {
			console.error(e);
			return null;
		}
	}
	function hashedPathFor(plainPath) {
		if (fileNames === void 0) fileNames = findFileNames();
		const entry = fileNames?.[plainPath.slice(plainPath.lastIndexOf("/") + 1)];
		if (entry && typeof entry === "object") for (const value of Object.values(entry)) {
			if (typeof value !== "string") continue;
			const m = HASHED.exec(value);
			if (m && m[1] + m[2] === plainPath) return value;
		}
		hashedPaths ??= buildHashedPaths();
		return hashedPaths.get(plainPath);
	}
	var downloadBase;
	async function downloadUrlFor(plainPath) {
		if (downloadBase === void 0) downloadBase = await readDownloadBase();
		const hashed = hashedPathFor(plainPath);
		return hashed && downloadBase ? downloadBase.base + hashed + downloadBase.query : "";
	}
	async function listCachedFiles(prefix) {
		return listCacheKeys(prefix);
	}
	async function listGameFiles(prefix) {
		hashedPaths ??= buildHashedPaths();
		const all = new Set(await listCacheKeys(prefix));
		for (const path of hashedPaths.keys()) if (path.startsWith(prefix)) all.add(path);
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
	var iconUrls = new Map();
	function toBlobUrl(data) {
		return URL.createObjectURL(new Blob([data], { type: "image/png" }));
	}
	function pngBytes(canvas) {
		const url = canvas.toDataURL("image/png");
		const bin = atob(url.slice(url.indexOf(",") + 1));
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return bytes;
	}
	async function loadUnitIcons(ids) {
		const missing = [...new Set(ids.map(Number))].filter((id) => !iconUrls.has(id));
		if (missing.length) {
			const records = await readCacheRecords(missing.map((id) => `hero_icons/${id}.png`));
			for (let i = 0; i < missing.length; i++) {
				const data = records[i]?.data;
				iconUrls.set(missing[i], data ? toBlobUrl(data) : await downloadUrlFor(`hero_icons/${missing[i]}.png`));
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
				const skillId = heroById(id)?.skill?.[4];
				const texture = skillId ? skillById(skillId)?.icon_assetTexture : "";
				let url = "";
				if (texture) {
					const path = `skill_icons/${texture}.png`;
					const [record] = await readCacheRecords([path]);
					url = record?.data ? toBlobUrl(record.data) : await downloadUrlFor(path);
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
		const text = new TextDecoder().decode(new Uint8Array(xml.data));
		const frames = new Map();
		for (const m of text.matchAll(/<SubTexture name="([^"]+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)) frames.set(m[1], {
			x: Number(m[2]),
			y: Number(m[3]),
			w: Number(m[4]),
			h: Number(m[5])
		});
		return {
			bitmap: await createImageBitmap(new Blob([image.data], { type: "image/avif" })),
			frames
		};
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
				const name = heroById(id)?.iconAssetTexture ?? String(id).padStart(4, "0");
				const frame = atlas?.frames.get(String(name));
				let url = "";
				if (frame) {
					const canvas = document.createElement("canvas");
					canvas.width = size;
					canvas.height = size;
					canvas.getContext("2d").drawImage(atlas.bitmap, frame.x, frame.y, frame.w, frame.h, 0, 0, size, size);
					url = toBlobUrl(pngBytes(canvas));
				}
				iconUrls.set(key, url);
			}
			out[id] = iconUrls.get(key);
		}
		return out;
	}
	var ICON = 40;
	var PROGRESS_PER_ROW = 5;
	var TILE = 44;
	var GAP = 4;
	var PROGRESS_WIDTH = 236;
	var PIN_SVG = "<svg width=\"15\" height=\"15\" viewBox=\"0 0 16 16\" style=\"position: absolute; right: -4px; top: -5px;\"><path d=\"M10.5 1.5l4 4-1.6.6-2.7 2.7.5 3.3-1.4 1.4-2.8-2.8-3.6 3.6-.9-.9 3.6-3.6-2.8-2.8 1.4-1.4 3.3.5 2.7-2.7z\" fill=\"#e5533d\" stroke=\"#3a1a0e\" stroke-width=\"0.8\" stroke-linejoin=\"round\"/></svg>";
	function groupTitle(kind) {
		switch (kind) {
			case "team": return I18N("NX_PROGRESS_TEAM");
			case "carry": return I18N("NX_PROGRESS_CARRY");
			case "sacrifice": return I18N("NX_PROGRESS_SACRIFICE");
			case "pets": return I18N("NX_PROGRESS_PETS");
		}
	}
	function progressTileHtml(id, need, state, icon) {
		const owned = Number(state.owned[id] ?? 0);
		const pinned = Number(state.pinned[id] ?? 0);
		const isPinned = pinned > 0;
		const have = isPinned ? owned + pinned : owned;
		const color = isPinned ? "#c9b18a" : have >= need ? "LimeGreen" : "#fbe0ac";
		const filter = isPinned ? "filter: grayscale(0.8) brightness(0.6);" : "";
		const picture = icon ? `<img src="${escapeAttr(icon)}" alt="" style="display: block; width: ${ICON}px; height: ${ICON}px; border-radius: 6px; ${filter}">` : `<div style="width: ${ICON}px; height: ${ICON}px; border-radius: 6px; background: #3a2414; ${filter}"></div>`;
		return `<div data-unit="${id}" title="${escapeAttr(unitName(id))}" style="width: ${TILE}px; text-align: center;"><div style="position: relative; width: ${ICON}px; height: ${ICON}px; margin: 0 auto; border: 1px solid #ce976799; border-radius: 7px;">${picture}${isPinned ? PIN_SVG : ""}</div><div style="font-size: 11px; line-height: 14px; color: ${color};">${have}/${need}</div></div>`;
	}
	function smallIconHtml(id, icon) {
		const box = "display: inline-block; width: 22px; height: 22px; border-radius: 4px; vertical-align: middle;";
		if (id <= 0) return `<span style="${box} background: #3a2414; text-align: center; line-height: 22px;">?</span>`;
		if (!icon) return `<span data-icon="${id}" style="${box} background: #3a2414;"></span>`;
		return `<img data-icon="${id}" src="${escapeAttr(icon)}" alt="" title="${escapeAttr(unitName(id))}" style="${box}">`;
	}
	function unitEventHtml(event, icons) {
		return `${Object.entries(event.units).map(([raw, count]) => {
			const id = Number(raw);
			const many = Number(count) > 1 ? `<span style="font-size: 11px; vertical-align: middle;">×${Number(count)}</span>` : "";
			return smallIconHtml(id, icons[id] ?? "") + many;
		}).join(" ")} ${eventText(event)}`;
	}
	function eventText(event) {
		const coins = event.coins;
		switch (event.kind) {
			case "pin": return I18N("NX_EVENT_PIN");
			case "unpin": return I18N("NX_EVENT_UNPIN");
			case "buy": return I18N("NX_EVENT_BUY", { coins });
			case "sell": return I18N("NX_EVENT_SELL", { coins });
		}
	}
	function progressColumnHtml(groups, state, icons) {
		return groups.map((group) => `<div style="margin-bottom: 6px;"><div style="font-size: 11px; color: #e8c9a0; margin-bottom: 3px;">${groupTitle(group.kind)}</div><div style="display: grid; grid-template-columns: repeat(${PROGRESS_PER_ROW}, ${TILE}px); gap: ${GAP}px;">` + group.units.map((unit) => progressTileHtml(unit.id, unit.need, state, icons[unit.id] ?? "")).join("") + "</div></div>").join("");
	}
	var NX_RUN_LOG_ID = "nxRunLog";
	var WIDTH = 420;
	var WIDTH_WITH_PROGRESS = WIDTH + PROGRESS_WIDTH + 10;
	var EDGE = 4;
	function clampToViewport(position, width, height, viewWidth, viewHeight) {
		const fit = (value, size, view) => {
			const max = Math.max(EDGE, (Number.isFinite(view) ? view : 0) - (Number.isFinite(size) ? size : 0) - EDGE);
			return Math.round(Math.min(max, Math.max(EDGE, Number.isFinite(value) ? value : EDGE)));
		};
		return {
			left: fit(position.left, width, viewWidth),
			top: fit(position.top, height, viewHeight)
		};
	}
	function oneLine(html) {
		return html.replace(/\s*<br\s*\/?>\s*/gi, " · ");
	}
	function savedPosition() {
		const saved = typeof getSaveVal === "function" ? getSaveVal(NX_SAVE_KEYS.logPosition, null) : null;
		if (!saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return null;
		return {
			left: Number(saved.left),
			top: Number(saved.top)
		};
	}
	var PANEL_STYLE = [
		"position: fixed",
		"right: 110px",
		"top: 60px",
		`width: ${WIDTH}px`,
		"max-height: calc(100vh * 2 / 3)",
		"display: flex",
		"flex-direction: column",
		"box-sizing: border-box",
		"padding: 8px 10px",
		"background: #190e08e6",
		"border: 2px solid #ce9767",
		"border-radius: 8px",
		"color: #fbe0ac",
		"font: 600 13px sans-serif",
		"letter-spacing: 0.5px",
		"z-index: 10000"
	].join("; ");
	var BUTTON_STYLE = [
		"background: #3a2414",
		"color: #fbe0ac",
		"border: 1px solid #ce9767",
		"border-radius: 5px",
		"padding: 2px 12px",
		"font: inherit",
		"cursor: pointer"
	].join("; ");
	var RunLog = class {
		box = null;
		live = null;
		titleHtml = "";
		briefHtml = "";
		lastHtml = "";
		collapsed = false;
		position = null;
		detach = [];
		groups = [];
		state = {
			owned: {},
			pinned: {}
		};
		icons = {};
		drawn = "";
		open(onStop) {
			document.getElementById(NX_RUN_LOG_ID)?.remove();
			const root = document.createElement("div");
			root.id = NX_RUN_LOG_ID;
			root.setAttribute("style", PANEL_STYLE);
			root.innerHTML = `<div data-part="head" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: move; user-select: none; touch-action: none;"><div data-part="title" style="flex: 1; min-width: 0; font-size: 15px; color: #ffcf84; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div><button data-part="collapse" type="button" style="${BUTTON_STYLE}; padding: 2px 8px;"></button><button data-part="stop" type="button" style="${BUTTON_STYLE}"></button></div><div data-part="brief" style="display: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div><div data-part="last" style="display: none; font-size: 12px; color: #e0a0a0; margin-bottom: 6px;"></div><div data-part="body" style="flex: 1; min-height: 0; display: flex; gap: 10px;"><div data-part="progress" style="display: none; flex: none; width: ${PROGRESS_WIDTH}px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #c49359 #190e08;"></div><div style="flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column;"><div data-part="list" style="flex: 1; overflow-y: auto; min-height: 40px; scrollbar-width: thin; scrollbar-color: #c49359 #190e08;"></div><div data-part="footer" style="display: none; margin-top: 6px; padding-top: 6px; border-top: 1px solid #ce976766;"></div></div></div>`;
			document.body.append(root);
			const part = (name) => root.querySelector(`[data-part="${name}"]`);
			const box = {
				root,
				head: part("head"),
				title: part("title"),
				collapse: part("collapse"),
				stop: part("stop"),
				brief: part("brief"),
				last: part("last"),
				body: part("body"),
				progress: part("progress"),
				list: part("list"),
				footer: part("footer")
			};
			this.box = box;
			this.live = null;
			this.titleHtml = "";
			this.briefHtml = "";
			box.stop.textContent = I18N("NX_LOG_STOP");
			box.stop.addEventListener("click", () => {
				this.stopping();
				onStop();
			});
			box.collapse.addEventListener("click", () => this.setCollapsed(!this.collapsed, true));
			this.setCollapsed(typeof getSaveVal === "function" && getSaveVal(NX_SAVE_KEYS.logCollapsed, false) === true, false);
			this.enableDrag(box);
			const saved = savedPosition();
			if (saved) this.place(saved);
			this.keepOnScreen(box);
		}
		stopping() {
			if (!this.box) return;
			this.box.stop.textContent = I18N("NX_LOG_STOPPING");
			this.box.stop.disabled = true;
		}
		isOpen() {
			return this.box !== null;
		}
		startAttempt(attempt, lastFailure) {
			const box = this.box;
			if (!box) return;
			this.titleHtml = I18N("NX_ATTEMPT", { attempt });
			box.title.innerHTML = this.titleHtml;
			box.list.innerHTML = "";
			box.footer.innerHTML = "";
			box.footer.style.display = "none";
			this.live = null;
			this.lastHtml = "";
			this.setBrief("");
			this.units({
				owned: {},
				pinned: {}
			});
			if (lastFailure) {
				box.last.innerHTML = I18N("NX_LOG_LAST_FAIL", lastFailure);
				box.last.style.display = this.collapsed ? "none" : "";
			} else {
				box.last.innerHTML = "";
				box.last.style.display = "none";
			}
		}
		plan(groups) {
			const box = this.box;
			if (!box) return;
			this.groups = groups;
			const shown = groups.length > 0;
			box.progress.style.display = shown ? "" : "none";
			box.root.style.width = `${shown ? WIDTH_WITH_PROGRESS : WIDTH}px`;
			this.drawn = "";
			this.drawProgress();
			if (this.position) this.place(this.position);
			if (!shown) return;
			this.loadIcons(groups.flatMap((group) => group.units.map((unit) => unit.id))).catch((e) => console.error(e));
		}
		async loadIcons(ids) {
			const missing = [...new Set(ids)].filter((id) => id > 0 && !(id in this.icons));
			if (!missing.length) return;
			const heroes = missing.filter((id) => id < NX_PET_ID_THRESHOLD);
			const pets = missing.filter((id) => id > NX_PET_ID_THRESHOLD);
			const [heroIcons, petIcons] = await Promise.all([loadHeroIcons(heroes, 80), loadUnitIcons(pets)]);
			this.icons = {
				...this.icons,
				...heroIcons,
				...petIcons
			};
			this.drawn = "";
			this.drawProgress();
		}
		unitEvent(event) {
			const box = this.box;
			if (!box) return;
			const html = unitEventHtml(event, this.icons);
			const element = this.addLine(box, html);
			this.lastHtml = html;
			this.setBrief(html);
			const ids = Object.keys(event.units).map(Number);
			if (ids.every((id) => id <= 0 || id in this.icons)) return;
			this.loadIcons(ids).then(() => {
				const fresh = unitEventHtml(event, this.icons);
				element.innerHTML = fresh;
				if (this.briefHtml === html) this.setBrief(fresh);
			}).catch((e) => console.error(e));
		}
		units(state) {
			this.state = {
				owned: { ...state.owned },
				pinned: { ...state.pinned }
			};
			this.drawProgress();
		}
		drawProgress() {
			const box = this.box;
			if (!box || this.groups.length === 0) return;
			const html = progressColumnHtml(this.groups, this.state, this.icons);
			if (html === this.drawn) return;
			this.drawn = html;
			box.progress.innerHTML = html;
		}
		status(point, coins) {
			const box = this.box;
			if (!box || !this.titleHtml) return;
			if (!point) {
				box.title.innerHTML = this.titleHtml;
				return;
			}
			const parts = [I18N("NX_LOG_POINT", { point }), I18N("NX_LOG_COINS", { coins })];
			box.title.innerHTML = `${this.titleHtml}<span style="font-size: 12px; color: #e8c9a0;"> · ${parts.join(" · ")}</span>`;
		}
		addLine(box, html) {
			const line = document.createElement("div");
			line.style.margin = "2px 0";
			line.innerHTML = html;
			box.list.append(line);
			box.list.scrollTop = box.list.scrollHeight;
			return line;
		}
		line(html, liveKey = null, important = false) {
			const box = this.box;
			if (!box) return;
			this.lastHtml = oneLine(html);
			if (important) this.setBrief(html);
			else if (!this.briefHtml) box.brief.innerHTML = this.lastHtml;
			if (liveKey) {
				const live = this.live;
				if (live && live.key === liveKey && live.element.isConnected) {
					live.element.innerHTML = html;
					return;
				}
				this.live = {
					key: liveKey,
					element: this.addLine(box, html)
				};
				return;
			}
			this.live = null;
			this.addLine(box, html);
		}
		fail(html) {
			const box = this.box;
			if (!box) return;
			this.live = null;
			box.footer.innerHTML = `<div style="color: #ff6b6b;">${html}</div><div data-part="timer" style="margin-top: 4px;"></div>`;
			box.footer.style.display = "";
			this.setBrief(`<span style="color: #ff6b6b;">${html}</span>`);
		}
		async countdown(seconds, stopped) {
			const finish = Date.now() + seconds * 1e3;
			const timer = this.box?.footer.querySelector("[data-part=\"timer\"]") ?? null;
			const reason = this.briefHtml;
			while (Date.now() < finish) {
				if (stopped()) return false;
				const text = I18N("NX_COOLDOWN", { seconds: ((finish - Date.now()) / 1e3).toFixed(1) });
				if (timer) timer.textContent = text;
				if (this.collapsed && this.box) this.box.brief.innerHTML = reason ? `${reason} · ${text}` : text;
				await sleep(100);
			}
			if (timer) timer.textContent = "";
			if (this.box) this.box.brief.innerHTML = this.briefHtml || this.lastHtml;
			return !stopped();
		}
		close() {
			for (const undo of this.detach.splice(0)) undo();
			this.box?.root.remove();
			this.box = null;
			this.live = null;
		}
		setBrief(html) {
			this.briefHtml = oneLine(html);
			if (this.box) this.box.brief.innerHTML = this.briefHtml || this.lastHtml;
		}
		setCollapsed(collapsed, save) {
			const box = this.box;
			if (!box) return;
			this.collapsed = collapsed;
			const shown = (element, visible) => {
				element.style.display = visible ? "" : "none";
			};
			shown(box.brief, collapsed);
			box.body.style.display = collapsed ? "none" : "flex";
			shown(box.last, !collapsed && Boolean(box.last.innerHTML));
			if (!collapsed) box.list.scrollTop = box.list.scrollHeight;
			box.collapse.textContent = collapsed ? "+" : "−";
			box.collapse.title = I18N(collapsed ? "NX_LOG_EXPAND" : "NX_LOG_COLLAPSE");
			if (save && typeof setSaveVal === "function") setSaveVal(NX_SAVE_KEYS.logCollapsed, collapsed);
			if (this.position) this.place(this.position);
		}
		place(position) {
			const box = this.box;
			if (!box || typeof window === "undefined") return;
			const next = clampToViewport(position, box.root.offsetWidth, box.root.offsetHeight, window.innerWidth, window.innerHeight);
			box.root.style.right = "auto";
			box.root.style.left = `${next.left}px`;
			box.root.style.top = `${next.top}px`;
			this.position = next;
		}
		enableDrag(box) {
			box.head.addEventListener("pointerdown", (event) => {
				if (event.button !== 0 || event.target?.closest?.("button")) return;
				const rect = box.root.getBoundingClientRect();
				const dx = event.clientX - rect.left;
				const dy = event.clientY - rect.top;
				try {
					box.head.setPointerCapture?.(event.pointerId);
				} catch {}
				event.preventDefault();
				const move = (e) => this.place({
					left: e.clientX - dx,
					top: e.clientY - dy
				});
				const end = () => {
					box.head.removeEventListener("pointermove", move);
					box.head.removeEventListener("pointerup", end);
					box.head.removeEventListener("pointercancel", end);
					if (this.position && typeof setSaveVal === "function") setSaveVal(NX_SAVE_KEYS.logPosition, this.position);
				};
				box.head.addEventListener("pointermove", move);
				box.head.addEventListener("pointerup", end);
				box.head.addEventListener("pointercancel", end);
			});
		}
		keepOnScreen(box) {
			if (typeof window === "undefined") return;
			const refit = () => {
				if (!box.root.isConnected) {
					for (const undo of this.detach.splice(0)) undo();
					return;
				}
				if (this.position && this.box === box) this.place(this.position);
			};
			window.addEventListener("resize", refit);
			this.detach.push(() => window.removeEventListener("resize", refit));
			if (typeof ResizeObserver === "function") {
				const observer = new ResizeObserver(refit);
				observer.observe(box.root);
				this.detach.push(() => observer.disconnect());
			}
		}
	};
	function afterBossReportHtml(report) {
		const small = (lines) => lines.map((e) => `<div style="font-size: 13px;">${e}</div>`).join("");
		return `<div style="text-align: left;"><div style="font-size: 20px;">Монет: <span style="color: LimeGreen;">${report.coins}</span></div><div style="margin-top: 10px;">Куда ушли монеты:</div>` + small(report.bookLines) + `<div style="margin-top: 10px;">Закреплено слотов: <span style="color: LimeGreen;">${report.pinnedLines.length}</span></div>` + small(report.pinnedLines) + "<div style=\"margin-top: 10px;\">Основной состав:</div>" + small(report.heroLines) + "<div style=\"margin-top: 10px;\">Питомцы:</div>" + small(report.petLines) + "<div style=\"margin-top: 10px;\">Проходные:</div>" + small(report.carryLines) + "</div>";
	}
	var RunWindows = class {
		log = new RunLog();
		onStop = () => {};
		open(onStop) {
			this.onStop = onStop;
			this.log.open(onStop);
		}
		attemptStart(attempt, lastFailure) {
			this.log.startAttempt(attempt, lastFailure);
		}
		line(text, liveKey, important = false) {
			if (this.log.isOpen()) {
				this.log.line(text, liveKey, important);
				return;
			}
			setProgress(text, false, this.onStop);
		}
		status(status) {
			this.log.status(status.point, status.coins);
		}
		plan(groups) {
			this.log.plan(groups);
		}
		units(state) {
			this.log.units(state);
		}
		unitEvent(event) {
			this.log.unitEvent(event);
		}
		fail(text) {
			this.log.fail(text);
		}
		countdown(seconds, stopped) {
			return this.log.countdown(seconds, stopped);
		}
		async notice(text, error) {
			setProgress("", true);
			await popup.confirm(failureHtml(text, error));
		}
		async askAfterBoss(report) {
			setProgress("", true);
			return await popup.confirm(I18N("NX_AFTER_BOSS_REPORT", {
				attempt: report.attempt,
				body: afterBossReportHtml(report)
			}), [{
				msg: I18N("NX_CONTINUE"),
				result: "continue",
				color: "green"
			}, {
				msg: I18N("NX_HALT"),
				result: "halt",
				isCancel: true,
				color: "red"
			}]) === "continue" ? "continue" : "halt";
		}
		close() {
			this.log.close();
		}
		replacing() {
			this.log.stopping();
			this.log.line(I18N("NX_REPLACING"), null);
		}
	};
	var CARD = 96;
	var OCTAGON = "polygon(22% 0, 78% 0, 100% 22%, 100% 78%, 78% 100%, 22% 100%, 0 78%, 0 22%)";
	var EMPTY_SLOT_FALLBACK = "linear-gradient(180deg, #4a3a5c 0%, #2a2038 100%)";
	var PET_HEAD_FILE = "js/pet_icons/pet_icons";
	var petHeadSymbol = (petId) => `pet_50_${petId}`;
	var PICKED_DIM = .55;
	var STAR_ANIM = ["epic_star_icon_mid_animated", {
		frames: 100,
		every: 2,
		scale: .9,
		renderScale: 1.5
	}];
	var STAR_PERIOD = 6e3;
	function gameCards(win) {
		const { piece, pic, label, animClass } = win;
		const plate = (symbol, value, fallbackBg, x, y) => piece(symbol, x, y, {
			size: [40, 28],
			fallback: `background: ${fallbackBg}; border-radius: 5px; border: 1px solid #000;`,
			cls: "nxNoHit"
		}) + label(value, x + 1, y - 2, 40, 28, 20, "#fff", "", {
			place: "anchor",
			drop: true
		});
		const check = (x, y) => piece("iconV", x, y, {
			size: [44, 40],
			fallback: "color: #5fe02a; font: 700 34px/40px sans-serif; text-align: center;",
			inner: "✔",
			cls: "nxNoHit"
		});
		const star = (key, count = 6) => {
			if (count >= 1 && count < 6) return starRow(count);
			const a = animClass(STAR_ANIM[0], STAR_ANIM[1]);
			if (!a) return piece("epic_star_icon_small", 29, 78, { cls: "nxNoHit" });
			return `<div class="nxP nxNoHit ${a.cls}" data-star="${key}" data-count="${a.count}" data-duration="${a.duration}" style="left: ${CARD / 2 - a.width / 2}px; top: ${102 - a.height}px; width: ${a.width}px; height: ${a.height}px; background-repeat: no-repeat;"></div>`;
		};
		const starRow = (count) => {
			const a = win.art("starIcon");
			const overlap = count === 5 ? 5 : 3;
			if (!a) return `<div class="nxP nxNoHit" style="left: 0; top: 82px; width: ${CARD}px; text-align: center; color: #ffd84a; font: 700 14px/18px sans-serif; text-shadow: 0 0 2px #000;">${"★".repeat(count)}</div>`;
			const width = count * a.width - (count - 1) * overlap;
			const left = CARD / 2 - width / 2;
			return Array.from({ length: count }, (_, i) => piece("starIcon", left + i * (a.width - overlap) - a.x, 102 - a.height - a.y, { cls: "nxNoHit" })).join("");
		};
		const starTimes = new Map();
		let starAnimations = [];
		const stopStars = () => {
			for (const animation of starAnimations) animation.cancel();
			starAnimations = [];
		};
		const startStars = (container) => {
			starAnimations = starAnimations.filter((animation) => {
				if (animation.effect?.target?.isConnected) return true;
				animation.cancel();
				return false;
			});
			const now = performance.now();
			for (const el of container.querySelectorAll("[data-star]")) {
				const key = el.dataset.star ?? "";
				let time = starTimes.get(key);
				if (!time) {
					time = {
						start: now,
						period: Math.floor(.3 * STAR_PERIOD + Math.random() * STAR_PERIOD * .7)
					};
					starTimes.set(key, time);
				}
				const share = Math.min(1, Number(el.dataset.duration) * 1e3 / time.period);
				if (!(share > 0)) continue;
				const animation = el.animate([
					{
						backgroundPositionX: "0%",
						offset: 0,
						easing: `steps(${el.dataset.count}, jump-none)`
					},
					{
						backgroundPositionX: "100%",
						offset: share
					},
					{
						backgroundPositionX: "100%",
						offset: 1
					}
				], {
					duration: time.period,
					iterations: Infinity
				});
				animation.currentTime = (now - time.start) % time.period;
				starAnimations.push(animation);
			}
		};
		win.onRender(startStars);
		win.onClose(stopStars);
		win.onHide(() => {
			for (const animation of starAnimations) animation.pause();
		});
		win.onShow(() => {
			const now = performance.now();
			for (const time of starTimes.values()) time.start = now;
			for (const animation of starAnimations) {
				animation.currentTime = 0;
				animation.play();
			}
		});
		const heroCard = (x, y, { icon, title, art, checked = false, attrs = "", starKey = "", stars }) => {
			const bg = piece(art.bg, 8, 8, {
				render: {
					width: 80,
					height: 80
				},
				cls: "nxNoHit"
			});
			return `<div ${attrs} class="nxBox" title="${escapeAttr(title)}" style="left: ${x}px; top: ${y}px; width: ${CARD}px; height: ${CARD}px;"><div class="nxNoHit" style="position: absolute; inset: 0; ${checked ? `filter: brightness(${PICKED_DIM});` : ""}">` + bg + `<div class="nxP ${pic(icon.key, icon.url)}" style="left: 8px; top: 8px; width: 80px; height: 80px; ${bg ? "" : "background-color: #1b1f45;"} border-radius: 4px;"></div>` + piece(art.frame, 0, 0, {
				size: [CARD, CARD],
				fallback: art.frameFallback
			}) + star(starKey, stars) + (art.level ? plate(art.plate, art.level, art.plateFallback, 28, -10) : "") + "</div>" + (checked ? check(52, 50) : "") + "</div>";
		};
		const petCard = (x, y, { icon, title, art, checked = false, attrs = "", starKey = "", stars }) => {
			const bg = piece(art.bg, 6, 6, {
				render: {
					width: 84,
					height: 84
				},
				cls: "nxNoHit",
				style: `clip-path: ${OCTAGON};`
			});
			return `<div ${attrs} class="nxBox" title="${escapeAttr(title)}" style="left: ${x}px; top: ${y}px; width: ${CARD}px; height: ${CARD}px;"><div class="nxNoHit" style="position: absolute; inset: 0; ${checked ? `filter: brightness(${PICKED_DIM});` : ""}">` + bg + `<div class="nxP ${pic(icon.key, icon.url)}" style="left: 6px; top: 6px; width: 84px; height: 84px; ${bg ? "" : "background-color: #1b1f45;"} clip-path: ${OCTAGON};"></div>` + piece(art.frame, 0, 0, {
				size: [CARD, CARD],
				fallback: art.frameFallback
			}) + star(starKey, stars) + (art.level ? plate(art.plate, art.level, art.plateFallback, 28, -10) : "") + "</div>" + (checked ? check(52, 50) : "") + "</div>";
		};
		const slotBase = (x, y, octagon = false) => piece(octagon ? "petEmptySlot" : "emptySlot", x, y, {
			size: [CARD, CARD],
			fallback: `background: ${EMPTY_SLOT_FALLBACK}; opacity: 0.4; ${octagon ? `clip-path: ${OCTAGON};` : "border-radius: 6px;"}`,
			cls: "nxNoHit"
		});
		const emptySlot = (x, y, attrs = "", octagon = false) => `<div ${attrs} class="nxBox" style="left: ${x}px; top: ${y}px; width: ${CARD}px; height: ${CARD}px;">` + slotBase(0, 0, octagon) + "</div>";
		return {
			heroCard,
			petCard,
			plate,
			star,
			check,
			slotBase,
			emptySlot
		};
	}
	var SQUAD_FRAMES = {
		purple: "linear-gradient(180deg, #E151D2 0%, #DA4BD2 8%, #CC42CE 19%, #C840CB 31%, #C135CE 42%, #B82BCE 53%, #AC21CF 64%, #A418D8 75%, #9A0ED2 86%, #770AB4 100%)",
		orange: "linear-gradient(180deg, #FDA42B 0%, #FBC170 11%, #FB9E1E 19%, #FD9E1C 28%, #FBAE3C 36%, #FFC069 44%, #DB8A09 53%, #C47602 61%, #9F5802 69%, #864203 78%, #A95403 86%, #DB8906 100%)",
		red: "linear-gradient(180deg, #F2532E 0%, #E74F2C 11%, #E14925 19%, #D54021 36%, #C9331D 53%, #B72618 69%, #AF1E10 86%, #A41515 100%)",
		empty: EMPTY_SLOT_FALLBACK
	};
	var RANKS = [
		{
			rank: 1,
			label: "80",
			frame: SQUAD_FRAMES.purple,
			plate: "linear-gradient(180deg, #d562e0, #7d1aae)",
			dot: "#b82bce",
			key: "NX_RANK_PURPLE",
			gameFrame: "border_hero_purple4",
			gamePlate: "level_purple",
			gameBg: "bg_hero_purple"
		},
		{
			rank: 3,
			label: "100",
			frame: SQUAD_FRAMES.orange,
			plate: "linear-gradient(180deg, #ffc15a, #c06a05)",
			dot: "#f0a020",
			key: "NX_RANK_YELLOW",
			gameFrame: "border_hero_gold3",
			gamePlate: "level_gold",
			gameBg: "bg_hero_orange"
		},
		{
			rank: 7,
			label: "130",
			frame: SQUAD_FRAMES.red,
			plate: "linear-gradient(180deg, #ff6a48, #a81a12)",
			dot: "#d63a22",
			key: "NX_RANK_RED",
			gameFrame: "border_hero_red3",
			gamePlate: "level_red",
			gameBg: "bg_hero_red"
		}
	];
	var PET_GAME_ART = {
		frame: "border_pet_purple4",
		bg: "bg_pet_purple"
	};
	function rankCardArt(r) {
		return {
			bg: r.gameBg,
			frame: r.gameFrame,
			plate: r.gamePlate,
			level: r.label,
			frameFallback: `border: 5px solid; border-image: ${r.frame} 1;`,
			plateFallback: r.plate
		};
	}
	var EVENT_PET_ART = {
		bg: PET_GAME_ART.bg,
		frame: PET_GAME_ART.frame,
		plate: "level_purple",
		level: "130",
		frameFallback: `background: ${SQUAD_FRAMES.purple}; clip-path: ${OCTAGON}; opacity: 0.35;`,
		plateFallback: RANKS[0].plate
	};
	function rankOf(fragments) {
		const step = rankStep(fragments);
		return RANKS.find((r) => r.rank === step);
	}
	function frameFor(fragments) {
		return rankOf(fragments).frame;
	}
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
		const asset = {
			version: reader.u32(),
			images: [],
			frames: [],
			clips: [],
			states: [],
			scale9: new Map(),
			text: new Map()
		};
		const readState = (r, id) => {
			const clip = r.u16();
			r.u16();
			const name = r.str();
			const blend = r.u8();
			const colorMode = r.u8();
			r.u16();
			let alpha = 1;
			if (colorMode === 1) alpha = r.f32();
			else if (colorMode === 2) r.u32();
			else if (colorMode === 3) r.take(4 * (asset.version < RSX_LONG_COLOR_VERSION ? 8 : 20));
			let matrix = null;
			if (r.u8() === 33) matrix = [
				r.f32(),
				r.f32(),
				r.f32(),
				r.f32(),
				r.f32(),
				r.f32()
			];
			asset.states[id] = {
				clip,
				name: name.startsWith("instance") ? "" : name,
				blend,
				alpha,
				matrix
			};
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
						asset.scale9.set(clip, {
							x: r.u16(),
							y: r.u16(),
							w: r.u16(),
							h: r.u16()
						});
					}
				} else if (type === "textfield") {
					const n = r.u16();
					for (let j = 0; j < n; j++) {
						const clip = r.u16();
						const field = r.str();
						const font = r.str();
						const size = r.u16() / 100;
						const color = "#" + (r.u32() & 16777215).toString(16).padStart(6, "0");
						const align = r.u8();
						r.u8();
						asset.text.set(clip, {
							field,
							font,
							size,
							color,
							align
						});
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
						const data = new Reader(r.take(length - 3), r.le);
						asset.images[id] = { file: kind === 9 ? data.str() : "" };
						break;
					}
					case 512:
					case 513: {
						const id = r.u16();
						const image = r.u16();
						const rect = {
							x: r.i16(),
							y: r.i16(),
							w: r.i16(),
							h: r.i16()
						};
						const pivotX = asset.version === RSX_FLOAT_PIVOT_VERSION ? Math.trunc(2 * r.f32()) : r.i16();
						const pivotY = asset.version === RSX_FLOAT_PIVOT_VERSION ? Math.trunc(2 * r.f32()) : r.i16();
						const frame = {
							image,
							rect,
							dx: 0,
							dy: 0,
							fullW: rect.w,
							fullH: rect.h,
							ax: 0,
							ay: 0
						};
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
						asset.clips[id] = {
							id,
							className,
							frames
						};
						break;
					}
					case 1024:
						readState(r, r.u16());
						break;
					case 4352:
						readState(r, r.u32());
						break;
					case 4096: readExtensions(r);
				}
				r.pos = stop;
			}
		};
		await readChunks(reader, bytes.length - 4);
		return asset;
	}
	var GUI_FILES$1 = ["dialog_basic"];
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
	var assets = new Map();
	var rendered = new Map();
	var fullFrames = new Map();
	async function loadGameGui(extra = []) {
		const files = [...new Set([...GUI_FILES$1, ...extra])];
		const list = (await Promise.all(files.map((file) => {
			let asset = assets.get(file);
			if (!asset) {
				asset = loadAsset(file).catch((e) => (console.error(e), null));
				assets.set(file, asset);
			}
			return asset;
		}))).filter(Boolean);
		return list.length ? { assets: list } : null;
	}
	async function loadAsset(file) {
		const base = file.includes("/") ? file : `js/gui/${file}`;
		const bytes = await readGameFile(`${base}.rsx`);
		if (!bytes) return null;
		const asset = await parseRsx(bytes);
		asset.file = base.split("/").pop();
		const pattern = new RegExp(`^${base}(\\d+)\\.(png|avif|webp|jpg)$`);
		const sheetsOf = (paths) => paths.map((path) => pattern.exec(path)).filter(Boolean).sort((a, b) => Number(a[1]) - Number(b[1]));
		const cached = sheetsOf(await listCachedFiles(base));
		const sheets = asset.images.every((_, i) => Number(cached[i]?.[1]) === i) ? cached : sheetsOf(await listGameFiles(base));
		asset.sheets = [];
		for (let i = 0; i < asset.images.length; i++) {
			const match = sheets[i];
			const data = match ? await readGameFile(match[0]) : null;
			asset.sheets[i] = data ? await createImageBitmap(new Blob([data], { type: `image/${match[2]}` })) : null;
		}
		asset.byName = new Map();
		for (const clip of asset.clips) if (clip && clip.frames.length && !asset.byName.has(clip.className)) asset.byName.set(clip.className, clip);
		return asset;
	}
	function findClip(library, name, prefer) {
		const first = typeof prefer === "string" ? library.assets.find((a) => a.file === prefer) : prefer;
		for (const asset of first ? [first, ...library.assets] : library.assets) {
			const clip = asset.byName.get(name);
			if (clip) return {
				asset,
				clip
			};
		}
		return null;
	}
	var IDENTITY = [
		1,
		0,
		0,
		1,
		0,
		0
	];
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
	var stretched = (grid, m, scale) => grid && Math.abs(m[1]) + Math.abs(m[2]) < .001 && (Math.abs(m[0] - scale) > .001 || Math.abs(m[3] - scale) > .001);
	function frameBox(frame, m) {
		const xs = [];
		const ys = [];
		const x0 = -frame.ax;
		const y0 = -frame.ay;
		for (const [x, y] of [
			[x0, y0],
			[x0 + frame.fullW, y0],
			[x0, y0 + frame.fullH],
			[x0 + frame.fullW, y0 + frame.fullH]
		]) {
			xs.push(m[0] * x + m[2] * y + m[4]);
			ys.push(m[1] * x + m[3] * y + m[5]);
		}
		return [
			Math.min(...xs),
			Math.min(...ys),
			Math.max(...xs),
			Math.max(...ys)
		];
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
		const sx = [
			0,
			grid.x,
			grid.x + grid.w,
			frame.fullW
		];
		const sy = [
			0,
			grid.y,
			grid.y + grid.h,
			frame.fullH
		];
		const dx = [
			0,
			left,
			W - right,
			W
		];
		const dy = [
			0,
			top,
			H - bottom,
			H
		];
		g.setTransform(1, 0, 0, 1, m[4] - m[0] * frame.ax - m[2] * frame.ay, m[5] - m[1] * frame.ax - m[3] * frame.ay);
		for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
			const sw = sx[i + 1] - sx[i];
			const sh = sy[j + 1] - sy[j];
			const dw = dx[i + 1] - dx[i];
			const dh = dy[j + 1] - dy[j];
			if (sw > 0 && sh > 0 && dw > 0 && dh > 0) g.drawImage(src, sx[i], sy[j], sw, sh, dx[i], dy[j], dw, dh);
		}
	}
	function renderFrames(library, name, frames, opts) {
		const { width = 0, height = 0, scale = 1, only = null, hide = null, exclude = null, file = null, renderScale = RENDER_SCALE, format = "png" } = opts;
		const hit = findClip(library, name, file);
		if (!hit) return null;
		const pick = only ? (n) => only.includes(n) : hide ? (n) => !hide.includes(n) : null;
		const box = [
			Infinity,
			Infinity,
			-Infinity,
			-Infinity
		];
		const grow = (asset, frame, grid, m) => {
			const b = frameBox(frame, m);
			box[0] = Math.min(box[0], b[0]);
			box[1] = Math.min(box[1], b[1]);
			box[2] = Math.max(box[2], b[2]);
			box[3] = Math.max(box[3], b[3]);
		};
		for (const frame of frames) walk({
			library,
			frame,
			pick,
			exclude,
			visit: grow
		}, hit.asset, hit.clip, IDENTITY, 1, 0, 0);
		if (!(box[0] < box[2] && box[1] < box[3])) return null;
		const naturalW = box[2] - box[0];
		const naturalH = box[3] - box[1];
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
			const base = [
				kx * renderScale,
				0,
				0,
				ky * renderScale,
				index * cellW - box[0] * kx * renderScale,
				-box[1] * ky * renderScale
			];
			const visit = (asset, piece, grid, m, alpha, blend) => drawFrame(g, asset, piece, grid, m, alpha, blend, renderScale);
			walk({
				library,
				frame,
				pick,
				exclude,
				visit
			}, hit.asset, hit.clip, base, 1, 0, 0);
		});
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.globalAlpha = 1;
		g.globalCompositeOperation = "source-over";
		return {
			url: format === "jpeg" ? canvas.toDataURL("image/jpeg", .85) : canvas.toDataURL("image/png"),
			width: W,
			height: H,
			x: box[0] * kx,
			y: box[1] * ky,
			count: frames.length
		};
	}
	function renderGui(library, name, opts = {}) {
		if (!library) return null;
		const key = JSON.stringify([name, opts]);
		if (!rendered.has(key)) rendered.set(key, renderFrames(library, name, [0], opts));
		return rendered.get(key);
	}
	function renderGuiAnimation(library, name, opts = {}) {
		if (!library) return null;
		const key = JSON.stringify([
			"anim",
			name,
			opts
		]);
		if (!rendered.has(key)) {
			const hit = findClip(library, name, opts.file ?? null);
			const total = opts.frames || hit?.clip.frames.length || 1;
			const every = Math.max(1, opts.every ?? 1);
			const list = [];
			for (let f = 0; f < total; f += every) list.push(f);
			const result = hit ? renderFrames(library, name, list, opts) : null;
			rendered.set(key, result ? {
				...result,
				duration: total / GUI_FPS
			} : null);
		}
		return rendered.get(key);
	}
	function handleAsync(handler) {
		return (...args) => {
			handler(...args).catch((e) => console.error(e));
		};
	}
	function startingHeroes(chapterId) {
		return Object.entries(chapterById(chapterId)?.initialUnitFragments ?? {}).filter(([, fragments]) => Number(fragments) > 0).map(([id]) => Number(id));
	}
	function pointOneHeroes(chapterId) {
		const chapter = chapterById(chapterId);
		const shopId = stallShopId();
		const shop = shopId === false ? void 0 : shopById(shopId);
		if (!chapter?.initialUnitFragments && !shop?.slots) return null;
		const heroes = new Set(startingHeroes(chapterId));
		for (const template of Object.values(shop?.slots ?? {}).flat()) {
			if (Number(template.level) !== 0) continue;
			for (const id of Object.keys(template.reward?.invasionFragmentHero ?? {})) if (Number(id) > 0) heroes.add(Number(id));
		}
		return heroes;
	}
	function carryUnavailable(chapterId, carryHeroes, carryExtraHeroes = []) {
		const heroes = pointOneHeroes(chapterId);
		if (!heroes) return [];
		const main = carryHeroes.filter((id) => !heroes.has(id));
		const extras = carryExtraHeroes.length > 0 && !carryExtraHeroes.some((id) => heroes.has(id)) ? carryExtraHeroes : [];
		return [...main, ...extras];
	}
	function carryPointOneError(setup) {
		const missing = carryUnavailable(setup.chapterId, setup.carryHeroes, setup.carryExtraHeroes ?? []);
		if (missing.length === 0) return null;
		const start = startingHeroes(setup.chapterId);
		return I18N("NX_ERR_CARRY_POINT1", {
			list: missing.map(unitLabel).join(", "),
			start: start.length ? start.map(unitLabel).join(", ") : "—"
		});
	}
	var SHADOW_DY = 2;
	var SHADOW_ALPHA = .5;
	var DROP_DY = 2;
	var DROP_ALPHA = .3;
	var CAP_HEIGHT = .711;
	var isObj = (v) => typeof v === "object" && v !== null;
	var gameClass = (name) => {
		const value = typeof selfGame !== "undefined" && selfGame ? selfGame[name] : void 0;
		return typeof value === "function" ? value : null;
	};
	var numbersOf = (o) => Object.values(o).filter((v) => typeof v === "number");
	var fieldOf = (o, test) => Object.values(o).find(test);
	var cached = new Map();
	function gameFont(size, multiline = false, name = "Roboto Condensed") {
		const key = `${name}:${size}:${multiline}`;
		const known = cached.get(key);
		if (known) return known;
		try {
			const found = findFont(name, size, multiline);
			if (found) cached.set(key, found);
			return found;
		} catch (e) {
			console.error(e);
			return null;
		}
	}
	function findFont(name, size, multiline) {
		const AssetStorage = gameClass("game.assets.storage.AssetStorage");
		const FontAssetStorage = gameClass("game.assets.storage.FontAssetStorage");
		const BitmapFont = gameClass("starling.text.BitmapFont");
		const SubTexture = gameClass("starling.textures.SubTexture");
		const ConcreteTexture = gameClass("starling.textures.ConcreteTexture");
		const BitmapData = gameClass("openfl.display.BitmapData");
		const Rectangle = gameClass("openfl.geom.Rectangle");
		if (!AssetStorage || !FontAssetStorage || !BitmapFont || !SubTexture || !ConcreteTexture || !BitmapData || !Rectangle) return null;
		const storage = Object.values(AssetStorage).find((v) => v instanceof FontAssetStorage);
		if (!isObj(storage)) return null;
		const isFont = (v) => v instanceof BitmapFont && Object.values(v).includes(name);
		const copy = Object.values(storage).filter(isFont).map((font) => {
			const [, native = 0, lineHeight = 0, own = 0] = numbersOf(font);
			return {
				font,
				native,
				lineHeight,
				own
			};
		}).filter((c) => c.own === size).sort((a, b) => multiline ? a.lineHeight - b.lineHeight : b.lineHeight - a.lineHeight)[0];
		if (!copy) return null;
		const { font, native, lineHeight } = copy;
		const isSub = (v) => v instanceof SubTexture;
		const isRect = (v) => v instanceof Rectangle;
		const placeOf = (sub) => {
			const region = fieldOf(sub, isRect);
			if (!region) return null;
			let x = region.x;
			let y = region.y;
			let parent = Object.values(sub).find((v) => isSub(v) || v instanceof ConcreteTexture);
			while (isSub(parent)) {
				const r = fieldOf(parent, isRect);
				if (!r) return null;
				x += r.x;
				y += r.y;
				parent = Object.values(parent).find((v) => (isSub(v) || v instanceof ConcreteTexture) && v !== parent);
			}
			return isObj(parent) && parent instanceof ConcreteTexture ? {
				x,
				y,
				w: region.width,
				h: region.height,
				root: parent
			} : null;
		};
		const fontTexture = fieldOf(font, isSub);
		const fontPlace = fontTexture ? placeOf(fontTexture) : null;
		if (!fontTexture || !fontPlace) return null;
		const atlas = findImage(fontPlace.root, BitmapData);
		if (!atlas) return null;
		const charStore = Object.values(font).filter(isObj).flatMap((m) => [m, ...Object.values(m).filter(isObj)]).find((s) => {
			const sample = s[72] ?? s[65];
			return isObj(sample) && Object.values(sample).some(isSub);
		});
		if (!charStore) return null;
		const glyphs = new Map();
		for (const [key, entry] of Object.entries(charStore)) {
			const code = Number(key);
			if (!Number.isInteger(code) || !isObj(entry)) continue;
			const nums = numbersOf(entry);
			const sub = fieldOf(entry, isSub);
			if (!sub || nums.length < 4 || nums[0] !== code) continue;
			const sx = fieldOf(sub, isRect);
			if (!sx) continue;
			const kerning = new Map();
			const kernMap = Object.values(entry).find((v) => isObj(v) && !isSub(v));
			if (isObj(kernMap)) {
				const store = [kernMap, ...Object.values(kernMap).filter(isObj)].find((s) => Object.keys(s).some((k) => Number.isInteger(Number(k))));
				if (store) {
					for (const [k, v] of Object.entries(store)) if (typeof v === "number") kerning.set(Number(k), v);
				}
			}
			glyphs.set(code, {
				sx: fontPlace.x + sx.x,
				sy: fontPlace.y + sx.y,
				sw: sx.width,
				sh: sx.height,
				xOffset: nums[1],
				yOffset: nums[2],
				xAdvance: nums[3],
				kerning
			});
		}
		const H = glyphs.get(72);
		const ink = H ? inkRows(atlas, H) : null;
		if (!ink || !native || lineHeight < native * .75 || lineHeight > native * 1.5) return null;
		if (Math.abs(native - (ink.bottom - ink.top) / CAP_HEIGHT) > 3) return null;
		return {
			atlas,
			size: native,
			lineHeight,
			glyphs
		};
	}
	function findImage(root, BitmapData) {
		const data = Object.values(root).find((v) => v instanceof BitmapData);
		const sizes = numbersOf(root);
		const visit = (o, depth) => {
			if (!isObj(o) || depth > 3) return null;
			for (const v of Object.values(o)) {
				if ((v instanceof HTMLCanvasElement || v instanceof HTMLImageElement) && sizes.includes(v.width) && sizes.includes(v.height)) return v;
				const deeper = isObj(v) && !(v instanceof Node) ? visit(v, depth + 1) : null;
				if (deeper) return deeper;
			}
			return null;
		};
		return visit(data, 0);
	}
	function inkRows(atlas, g) {
		const probe = document.createElement("canvas");
		probe.width = Math.ceil(g.sw);
		probe.height = Math.ceil(g.sh);
		const ctx = probe.getContext("2d", { willReadFrequently: true });
		if (!ctx) return null;
		ctx.drawImage(atlas, g.sx, g.sy, g.sw, g.sh, 0, 0, g.sw, g.sh);
		const { data, width, height } = ctx.getImageData(0, 0, probe.width, probe.height);
		let top = -1;
		let bottom = -1;
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 128) {
			if (top < 0) top = y;
			bottom = y + 1;
			break;
		}
		return top < 0 ? null : {
			top: g.yOffset + top,
			bottom: g.yOffset + bottom
		};
	}
	function gameFontHas(font, text) {
		for (const ch of text) if (!font.glyphs.has(ch.codePointAt(0))) return false;
		return true;
	}
	var SHEET_WIDTH = 2048;
	function paintGameTexts(items) {
		const lines = items.map(lineOf);
		const ready = lines.filter((line) => line !== null);
		if (!ready.length) return lines.map(Boolean);
		const gap = Math.ceil(Math.max(SHADOW_DY, DROP_DY) * Math.max(1, ...ready.map((line) => line.opts.scale))) + 2;
		const placed = [];
		let x = 0;
		let y = 0;
		let rowH = 0;
		let width = 1;
		for (const line of ready) {
			if (x && x + line.W > SHEET_WIDTH) {
				x = 0;
				y += rowH + gap;
				rowH = 0;
			}
			placed.push({
				line,
				rx: x,
				ry: y
			});
			x += line.W + gap;
			rowH = Math.max(rowH, line.H);
			width = Math.max(width, x);
		}
		const height = y + rowH;
		const sheet = () => {
			const c = document.createElement("canvas");
			c.width = width;
			c.height = height;
			return c.getContext("2d");
		};
		const black = sheet();
		const colored = sheet();
		for (const { line, rx, ry } of placed) {
			drawGlyphs(black, line, rx, ry);
			drawGlyphs(colored, line, rx, ry);
		}
		black.globalCompositeOperation = "source-in";
		black.fillStyle = "#000";
		black.fillRect(0, 0, width, height);
		colored.globalCompositeOperation = "source-in";
		const byColor = new Map();
		for (const item of placed) byColor.set(item.line.opts.color, [...byColor.get(item.line.opts.color) ?? [], item]);
		for (const [color, group] of byColor) {
			colored.save();
			colored.beginPath();
			for (const { line, rx, ry } of group) colored.rect(rx, ry, line.W, line.H);
			colored.clip();
			colored.fillStyle = color;
			colored.fillRect(0, 0, width, height);
			colored.restore();
		}
		const drops = placed.filter(({ line }) => line.opts.drop);
		let silhouette = null;
		if (drops.length) {
			silhouette = sheet();
			for (const { line, rx, ry } of drops) {
				silhouette.save();
				silhouette.setTransform(1, 0, 0, 1, rx, ry);
				silhouette.beginPath();
				silhouette.rect(0, 0, line.W, line.H);
				silhouette.clip();
				withShadow(silhouette, black.canvas, black.canvas, line, rx, ry);
				silhouette.restore();
			}
		}
		for (const { line, rx, ry } of placed) {
			const { canvas, W, H, opts } = line;
			canvas.width = W;
			canvas.height = H;
			const ctx = canvas.getContext("2d");
			withShadow(ctx, black.canvas, colored.canvas, line, rx, ry);
			if (opts.drop && silhouette) {
				ctx.globalCompositeOperation = "destination-over";
				ctx.globalAlpha = DROP_ALPHA;
				ctx.drawImage(silhouette.canvas, rx, ry, W, H, 0, DROP_DY * opts.scale, W, H);
				ctx.globalCompositeOperation = "source-over";
				ctx.globalAlpha = 1;
			}
		}
		for (const ctx of [
			black,
			colored,
			silhouette
		]) {
			if (!ctx) continue;
			ctx.canvas.width = 0;
			ctx.canvas.height = 0;
		}
		return lines.map(Boolean);
	}
	function drawGlyphs(ctx, line, rx, ry) {
		const { font, k, left, top, quads, W, H } = line;
		const { scale } = line.opts;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, rx, ry);
		ctx.beginPath();
		ctx.rect(0, 0, W, H);
		ctx.clip();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "low";
		for (const { g, x } of quads) ctx.drawImage(font.atlas, g.sx, g.sy, g.sw, g.sh, left + (x + g.xOffset) * k * scale, top + g.yOffset * k * scale, g.sw * k * scale, g.sh * k * scale);
		ctx.restore();
	}
	function withShadow(ctx, black, colored, line, rx, ry) {
		const { W, H, opts } = line;
		ctx.globalAlpha = SHADOW_ALPHA;
		ctx.drawImage(black, rx, ry, W, H, 0, SHADOW_DY * opts.scale, W, H);
		ctx.globalAlpha = 1;
		ctx.drawImage(colored, rx, ry, W, H, 0, 0, W, H);
	}
	function lineOf({ canvas, font, text, opts }) {
		const { size, scale, boxX, boxY, boxW, boxH, width, height, place = "center" } = opts;
		const k = size / font.size;
		const layout = (value) => {
			const quads = [];
			let x = 0;
			let prev = 0;
			for (const ch of value) {
				const code = ch.codePointAt(0);
				const g = font.glyphs.get(code);
				if (!g) return null;
				x += g.kerning.get(prev) ?? 0;
				quads.push({
					g,
					x
				});
				x += g.xAdvance;
				prev = code;
			}
			return {
				quads,
				width: x * k
			};
		};
		let line = layout(text);
		if (!line) return null;
		for (let cut = text.length - 1; line.width > boxW && cut > 0; cut--) {
			const shorter = layout(text.slice(0, cut).trimEnd() + "...");
			if (!shorter) return null;
			line = shorter;
		}
		const lineBox = font.lineHeight * k;
		const free = boxW - line.width;
		const dx = place === "anchor" ? boxW / 2 - Math.round(Math.ceil(line.width) / 2) : place === "top" ? Math.round(free / 2) : free / 2;
		const dy = place === "anchor" ? boxH / 2 - Math.round(lineBox / 2) : place === "top" ? 0 : (boxH - lineBox) / 2;
		return {
			canvas,
			font,
			opts,
			k,
			W: Math.max(1, Math.round(width)),
			H: Math.max(1, Math.round(height)),
			left: boxX + dx * scale,
			top: boxY + dy * scale,
			quads: line.quads
		};
	}
	var OVERLAY_SYMBOL = "popup_overlay";
	var GAME_STAGE = {
		w: 1400,
		h: 640
	};
	var TEXT_MARGIN = 4;
	function decodeHtml(value) {
		const area = document.createElement("textarea");
		area.innerHTML = value;
		return area.value;
	}
	var fallbackText = (size, color) => `font-family: 'Roboto Condensed', 'Arial Narrow', sans-serif; font-weight: 700; font-size: ${size}px; color: ${color}; text-shadow: 0 1px 1px rgba(0, 0, 0, 0.75), 0 2px 4px rgba(0, 0, 0, 0.5);`;
	var baseCss = (id, zIndex, stageW, stageH) => `
#${id} { position: fixed; inset: 0; z-index: ${zIndex}; background: radial-gradient(ellipse at 50% 35%, #3a2414 0%, #190e08 55%, #0c0704 100%); display: flex; align-items: center; justify-content: center; user-select: none; }
#${id} .nxStage { position: relative; width: ${stageW}px; height: ${stageH}px; flex: none; transform-origin: 0 0; }
#${id} .nxP, #${id} .nxT, #${id} .nxBox, #${id} .nxList { position: absolute; box-sizing: border-box; }
#${id} .nxP { background-size: 100% 100%; background-repeat: no-repeat; }
#${id} .nxT { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
#${id} .nxBox { cursor: pointer; }
#${id} .nxNoHit { pointer-events: none; }
#${id} .nxList { overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; scrollbar-color: #c49359 #190e08; }
#${id} .nxItem .nxHover { opacity: 0; }
#${id} .nxItem:hover .nxHover { opacity: 1; }
#${id} .nxItem:hover .nxIdle { opacity: 0; }
#${id} .nxAnim { background-repeat: no-repeat; animation-name: nxStrip; animation-iteration-count: infinite; }
#${id} .nxBackdrop { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; }
#${id}.nxHidden { visibility: hidden; }
@keyframes nxStrip { from { background-position-x: 0%; } to { background-position-x: 100%; } }
`;
	var openWindows = new Map();
	function openGameWindow({ id, zIndex, stageW, stageH, maxScale, library }) {
		openWindows.get(id)?.();
		const root = document.createElement("div");
		root.id = id;
		const baseStyle = document.createElement("style");
		baseStyle.textContent = baseCss(id, zIndex, stageW, stageH);
		const artStyle = document.createElement("style");
		const holder = document.createElement("div");
		const stage = document.createElement("div");
		stage.className = "nxStage";
		holder.append(stage);
		const backdrop = document.createElement("canvas");
		backdrop.className = "nxBackdrop";
		root.append(baseStyle, artStyle, backdrop, holder);
		document.body.append(root);
		const renderHooks = [];
		const closeHooks = [];
		let scale = 1;
		const classes = new Map();
		const addRule = (rule) => {
			const sheet = artStyle.sheet;
			if (sheet) sheet.insertRule(rule, sheet.cssRules.length);
			else artStyle.append(rule);
		};
		const addClass = (key, url) => {
			if (!classes.has(key)) {
				const cls = `nxC${classes.size}`;
				classes.set(key, cls);
				addRule(`#${id} .${cls} { background-image: url("${url}"); }`);
			}
			return classes.get(key);
		};
		const art = (symbol, opts = {}) => {
			const r = renderGui(library, symbol, opts);
			return r ? {
				...r,
				cls: addClass(JSON.stringify([symbol, opts]), r.url)
			} : null;
		};
		const pic = (key, url) => url ? addClass(key, url) : "";
		const animClass = (symbol, opts) => {
			const r = renderGuiAnimation(library, symbol, opts);
			if (!r || r.count < 2) return null;
			const key = JSON.stringify([
				"anim",
				symbol,
				opts
			]);
			if (!classes.has(key)) {
				const cls = `nxC${classes.size}`;
				classes.set(key, cls);
				addRule(`#${id} .${cls} { background-image: url("${r.url}"); background-size: ${r.count * 100}% 100%; animation-duration: ${r.duration}s; animation-timing-function: steps(${r.count}, jump-none); }`);
			}
			return {
				...r,
				cls: classes.get(key)
			};
		};
		const anim = ([symbol, opts], x, y, { center = false, cls = "", style = "" } = {}) => {
			const a = animClass(symbol, opts);
			if (!a) return "";
			const left = center ? x - a.width / 2 : x + a.x;
			const top = center ? y - a.height : y + a.y;
			const phase = performance.now() / 1e3 % a.duration;
			return `<div class="nxP nxAnim ${a.cls} ${cls}" style="left: ${left}px; top: ${top}px; width: ${a.width}px; height: ${a.height}px; animation-delay: -${phase.toFixed(3)}s; ${style}"></div>`;
		};
		const piece = (symbol, x, y, { render = {}, size = null, fallback = "", inner = "", attrs = "", cls = "", style = "" } = {}) => {
			const a = art(symbol, render);
			if (a) return `<div ${attrs} class="nxP ${a.cls} ${cls}" style="left: ${x + a.x}px; top: ${y + a.y}px; width: ${a.width}px; height: ${a.height}px; ${style}"></div>`;
			if (!fallback || !size) return "";
			return `<div ${attrs} class="nxP ${cls}" style="left: ${x}px; top: ${y}px; width: ${size[0]}px; height: ${size[1]}px; ${fallback} ${style}">${inner}</div>`;
		};
		const cover = (symbol, fallback, attrs = "") => {
			const a = art(symbol, { renderScale: 1 });
			return `<div ${attrs} data-cover="1" class="nxP ${a?.cls ?? ""}" style="${a ? "" : `inset: 0; ${fallback}`}"></div>`;
		};
		const fonts = new Map();
		const fontOf = (size) => {
			if (!fonts.has(size)) fonts.set(size, gameFont(size));
			return fonts.get(size) ?? null;
		};
		const label = (value, x, y, w, h, size, color, extra = "", { place = "center", drop = false } = {}) => {
			const raw = value.includes("<") ? null : decodeHtml(value);
			const font = fontOf(size);
			if (font && raw !== null && gameFontHas(font, raw)) return `<canvas class="nxT nxText" data-text="${escapeAttr(raw)}" data-size="${size}" data-color="${color}" data-place="${place}"${drop ? " data-drop" : ""} data-box="${x},${y},${w},${h}" style="left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px; ${extra}"></canvas>`;
			const lh = Math.max(h, Math.round(size * 1.4));
			return `<div class="nxT" style="left: ${x}px; top: ${y - (lh - h) / 2}px; width: ${w}px; height: ${lh}px; line-height: ${lh}px; text-align: center; ${fallbackText(size, color)} ${extra}">${value}</div>`;
		};
		const paintTexts = (container = stage) => {
			const canvases = (Array.isArray(container) ? container : [container]).flatMap((part) => [...part.querySelectorAll("canvas.nxText")]);
			const boxes = canvases.map((el) => {
				const [x = 0, y = 0, w = 0, h = 0] = (el.dataset.box ?? "").split(",").map(Number);
				el.style.left = `${x}px`;
				el.style.top = `${y}px`;
				el.style.width = `${w}px`;
				el.style.height = `${h}px`;
				return {
					x,
					y,
					w,
					h
				};
			});
			const rects = canvases.map((el) => el.getBoundingClientRect());
			const margin = Math.ceil(TEXT_MARGIN * scale);
			const items = [];
			const places = [];
			canvases.forEach((el, index) => {
				const size = Number(el.dataset.size);
				const font = fontOf(size);
				if (!font) return;
				const box = boxes[index];
				const rect = rects[index];
				const below = margin + Math.ceil(Math.max(0, font.lineHeight * size / font.size - box.h) * scale);
				const x0 = Math.floor(rect.left) - margin;
				const y0 = Math.floor(rect.top) - margin;
				const width = Math.ceil(rect.right) + margin - x0;
				const height = Math.ceil(rect.bottom) + below - y0;
				items.push({
					canvas: el,
					font,
					text: el.dataset.text ?? "",
					opts: {
						size,
						color: el.dataset.color ?? "#fff",
						scale,
						boxX: rect.left - x0,
						boxY: rect.top - y0,
						boxW: box.w,
						boxH: box.h,
						width,
						height,
						place: el.dataset.place ?? "center",
						drop: el.dataset.drop !== void 0
					}
				});
				places.push(() => {
					el.style.left = `${box.x + (x0 - rect.left) / scale}px`;
					el.style.top = `${box.y + (y0 - rect.top) / scale}px`;
					el.style.width = `${width / scale}px`;
					el.style.height = `${height / scale}px`;
				});
			});
			paintGameTexts(items);
			for (const place of places) place();
		};
		const overlay = renderGui(library, OVERLAY_SYMBOL, { renderScale: 1 });
		const overlayImage = new Image();
		const gameStageRect = () => {
			const k = Math.max(window.innerWidth / GAME_STAGE.w, window.innerHeight / GAME_STAGE.h);
			return {
				x: (window.innerWidth - GAME_STAGE.w * k) / 2,
				y: (window.innerHeight - GAME_STAGE.h * k) / 2,
				w: GAME_STAGE.w * k,
				h: GAME_STAGE.h * k
			};
		};
		const drawBackdrop = () => {
			if (!overlay || !overlayImage.complete || !overlayImage.naturalWidth) return;
			backdrop.width = window.innerWidth;
			backdrop.height = window.innerHeight;
			const ctx = backdrop.getContext("2d");
			if (!ctx) return;
			const r = gameStageRect();
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = "low";
			ctx.drawImage(overlayImage, r.x, r.y, r.w, r.h);
		};
		if (overlay) {
			overlayImage.src = overlay.url;
			overlayImage.decode().then(drawBackdrop, () => {});
		}
		const placeCovers = (root = stage) => {
			const covers = [...root.querySelectorAll("[data-cover]")].filter((el) => !el.style.inset);
			if (!covers.length) return;
			const r = gameStageRect();
			const at = holder.getBoundingClientRect();
			for (const el of covers) {
				el.style.left = `${(r.x - at.left) / scale}px`;
				el.style.top = `${(r.y - at.top) / scale}px`;
				el.style.width = `${r.w / scale}px`;
				el.style.height = `${r.h / scale}px`;
			}
		};
		let hidden = false;
		let fitPending = false;
		const fit = () => {
			if (hidden) {
				fitPending = true;
				return;
			}
			scale = Math.min(maxScale, (window.innerWidth - 32) / stageW, (window.innerHeight - 32) / stageH);
			stage.style.transform = `scale(${scale})`;
			holder.style.width = `${stageW * scale}px`;
			holder.style.height = `${stageH * scale}px`;
			drawBackdrop();
			placeCovers();
			paintTexts();
		};
		fit();
		window.addEventListener("resize", fit);
		let closed = false;
		const close = () => {
			if (closed) return;
			closed = true;
			if (openWindows.get(id) === close) openWindows.delete(id);
			window.removeEventListener("resize", fit);
			for (const hook of closeHooks) hook();
			root.remove();
		};
		openWindows.set(id, close);
		const hideHooks = [];
		const showHooks = [];
		const hide = () => {
			if (hidden || closed) return;
			hidden = true;
			root.classList.add("nxHidden");
			backdrop.width = 0;
			backdrop.height = 0;
			for (const hook of hideHooks) hook();
		};
		const show = () => {
			if (!hidden || closed) return;
			hidden = false;
			root.classList.remove("nxHidden");
			if (fitPending) {
				fitPending = false;
				fit();
			} else drawBackdrop();
			for (const hook of showHooks) hook();
		};
		return {
			root,
			stage,
			scale: () => scale,
			art,
			pic,
			piece,
			animClass,
			anim,
			cover,
			fontOf,
			label,
			part: (attrs, html) => `<div ${attrs} style="display: contents;">${html}</div>`,
			paintTexts,
			render: (html, container = stage) => {
				container.innerHTML = html;
				for (const hook of renderHooks) hook(container);
				placeCovers(container);
			},
			onRender: (hook) => {
				renderHooks.push(hook);
			},
			onClose: (hook) => {
				closeHooks.push(hook);
			},
			close,
			hide,
			show,
			onHide: (hook) => {
				hideHooks.push(hook);
			},
			onShow: (hook) => {
				showHooks.push(hook);
			}
		};
	}
	var MEDIUM = {
		green: {
			symbol: "green_labeled_button_140",
			field: [
				14,
				13,
				113,
				25
			],
			color: "#e4ff4c",
			fallback: "background: linear-gradient(180deg, #5cc234, #2f7d18); border-radius: 8px;"
		},
		boring: {
			symbol: "boring_buttonClip_140",
			field: [
				12,
				12,
				115,
				25
			],
			color: "#fce5b7",
			fallback: "background: linear-gradient(180deg, #8a6a44, #4a3018); border-radius: 8px;"
		}
	};
	function mediumButton(win, kind, x, y, text, attrs = "") {
		const { symbol, field, color, fallback } = MEDIUM[kind];
		const [fx, fy, fw, fh] = field;
		return win.piece(symbol, x, y, {
			size: [140, 48],
			fallback,
			attrs,
			cls: "nxBox"
		}) + win.label(text, x + fx, y + fy, fw, fh, 18, color, "", { place: "top" });
	}
	var TEAM_SIZE = 5;
	function nameMatches(name, query) {
		const needle = query.trim().toLocaleLowerCase();
		return !needle || name.toLocaleLowerCase().includes(needle);
	}
	var PICKER_Z = 10050;
	var STAGE_W = 940;
	var STAGE_H = 680;
	var OX = 140;
	var MAX_SCALE = 1.4;
	var GRID = {
		x: 46,
		y: 104,
		w: 555,
		h: 390,
		step: 110,
		rowStep: 112,
		cols: 5,
		padX: 9,
		padY: 12
	};
	var ROW = {
		y: 536,
		petX: 21,
		heroX: 123,
		step: 102.5
	};
	var BUTTON_STEP = 58;
	var ITEM = {
		w: 421,
		h: 112,
		gap: 5,
		left: 24,
		top: 67,
		bottom: 26
	};
	var TEXT_COLORS = {
		title: "#ffcf84",
		tabActive: "#b7f26b",
		tabIdle: "#fbe0ac",
		subHeader: "#fce5b7",
		patronHeader: "#f8dfb2",
		petName: "#fff",
		stats: "#fce5b7",
		free: "#f8e8c1",
		busy: "#f2e947",
		chosen: "#e4ff4c"
	};
	var FAVOR_GUI_FILE = "button_team_gather_hero_favor";
	var PORTRAIT = 160;
	var PRELOAD_IDLE_MS = 100;
	var SCROLL_SETTLE_MS = 150;
	var PAW_ANIM = ["icon_pet_favor_bouncing", { every: 2 }];
	var PAW_GLOW_ANIM = ["button_team_gather_hero_favor", {
		only: ["animation_glow"],
		exclude: ["icon_pet_favor_bouncing"],
		frames: 360,
		every: 6,
		renderScale: .75
	}];
	async function preloadUnitPicker(heroes, pets = []) {
		await loadGameGui([PET_HEAD_FILE, FAVOR_GUI_FILE]);
		for (const id of heroes) {
			await new Promise((resolve) => {
				if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: PRELOAD_IDLE_MS });
				else setTimeout(resolve, PRELOAD_IDLE_MS);
			});
			await loadHeroIcons([id], PORTRAIT);
		}
		await Promise.all([loadUnitIcons(pets), loadFavorSkillIcons(pets)]);
	}
	var keptPickers = new Map();
	var activeSession = null;
	var pickerSignature = ({ id, heroes, pets, limit, ranks, showRanks, petArt, texts, unitArt, unitStars }) => JSON.stringify([
		id,
		heroes,
		pets ?? null,
		limit,
		ranks,
		showRanks,
		petArt,
		texts,
		unitArt ?? null,
		unitStars ?? null
	]);
	async function openUnitPicker(options) {
		if (!options.ranks.length) throw new Error("openUnitPicker: нужен хотя бы один ранг");
		const signature = pickerSignature(options);
		const kept = keptPickers.get(options.id);
		if (kept && kept.signature === signature && kept.alive()) return kept.open(options);
		const picker = await buildUnitPicker(options, signature);
		if (!picker.alive()) return null;
		keptPickers.set(options.id, picker);
		return picker.open(options);
	}
	async function buildUnitPicker({ id: windowId, heroes, pets: petList, limit: wanted, ranks, showRanks, petArt, texts: firstTexts, validate: firstValidate, unitArt = {}, unitStars = {} }, signature) {
		const limit = Math.max(1, Math.min(TEAM_SIZE, Math.floor(wanted) || 1));
		const withPets = Array.isArray(petList);
		const pets = petList ?? [];
		const petLib = getPetLib();
		const [library, heroIcons, petIcons, skillIcons] = await Promise.all([
			loadGameGui([PET_HEAD_FILE, FAVOR_GUI_FILE]),
			loadHeroIcons(heroes, PORTRAIT),
			loadUnitIcons(pets),
			loadFavorSkillIcons(pets)
		]);
		const win = openGameWindow({
			id: windowId,
			zIndex: PICKER_Z,
			stageW: STAGE_W,
			stageH: STAGE_H,
			maxScale: MAX_SCALE,
			library
		});
		const { stage, pic, piece, anim, label } = win;
		const cards = gameCards(win);
		const { slotBase, emptySlot } = cards;
		const firstRank = ranks[0];
		const rankArt = (rank) => (ranks.find((r) => r.rank === rank) ?? firstRank).art;
		const heroCard = (id, rank, x, y, { checked = false, attrs = "", starKey = "" } = {}) => cards.heroCard(x, y, {
			icon: {
				key: `h${id}`,
				url: heroIcons[id]
			},
			title: unitName(id),
			art: unitArt[id] ?? rankArt(rank),
			checked,
			attrs,
			starKey,
			stars: unitStars[id]
		});
		const petCard = (id, x, y, { checked = false, attrs = "", starKey = "" } = {}) => cards.petCard(x, y, {
			icon: {
				key: `p${id}`,
				url: petIcons[id]
			},
			title: unitName(id),
			art: unitArt[id] ?? petArt,
			checked,
			attrs,
			starKey,
			stars: unitStars[id]
		});
		const team = new Map();
		let chosenMainPet = 0;
		let tab = "heroes";
		let message = "";
		let patronFor = 0;
		let texts = firstTexts;
		let validate = firstValidate;
		let searchText = "";
		const pawHtml = () => {
			const paw = anim(PAW_ANIM, 3, 3, { cls: "nxNoHit" });
			if (!paw) return piece("icon_pet_favor_not_set", 2, 2, {
				render: {
					width: 36,
					height: 36
				},
				size: [36, 36],
				fallback: "color: #5fe02a; font: 700 26px/36px sans-serif; text-align: center;",
				inner: "+"
			});
			return anim(PAW_GLOW_ANIM, 20, 20, { cls: "nxNoHit" }) + paw;
		};
		const patronBadge = (heroId, petId, x, y) => {
			const head = petId ? piece(petHeadSymbol(petId), -1, -3, {
				render: {
					file: "pet_icons",
					width: 42,
					height: 42
				},
				cls: "nxNoHit"
			}) : "";
			const inner = petId ? head || `<div class="nxP ${pic(`p${petId}`, petIcons[petId])}" style="left: 5px; top: 5px; width: 30px; height: 30px; border-radius: 50%; background-color: #1b1f45;"></div>` + piece("item_round_border_purple", 0, 0, {
				render: {
					width: 40,
					height: 40
				},
				size: [40, 40],
				fallback: "border: 3px solid #b82bce; border-radius: 50%;"
			}) : pawHtml();
			return `<div data-patron="${heroId}" class="nxBox" title="${escapeAttr(petId ? unitName(petId) : texts.patronAdd)}" style="left: ${x}px; top: ${y}px; width: 40px; height: 40px; z-index: 3;">${inner}</div>`;
		};
		const tabHtml = (id, value, y) => {
			const active = tab === id;
			const bg = piece("dialog_side_tab", 0, 0, {
				render: { hide: [active ? "bg_up" : "bg_selected"] },
				size: [174, 56],
				fallback: `background: ${active ? "linear-gradient(180deg, #5cc234, #2f7d18)" : "linear-gradient(180deg, #6a4526, #3a2414)"}; clip-path: polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%, 7% 50%);`
			});
			return `<div data-tab="${id}" class="nxBox" style="left: 8px; top: ${y}px; width: 174px; height: 64px;">` + bg + label(value, 21, 14, 132, 36, 18, active ? TEXT_COLORS.tabActive : TEXT_COLORS.tabIdle) + "</div>";
		};
		const sortedTeam = () => [...team.keys()].sort((a, b) => battleOrder(a) - battleOrder(b));
		const rowTeam = () => sortedTeam().reverse();
		const ownerOf = (petId) => [...team.entries()].find(([, v]) => v.pet === petId)?.[0] ?? 0;
		const grids = [{
			tab: "heroes",
			ids: heroes,
			title: texts.heroesTitle,
			checked: (id) => team.has(id),
			card: (id, x, y, checked) => heroCard(id, firstRank.rank, x, y, {
				checked,
				attrs: `data-hero-card="${id}"`,
				starKey: `grid-h${id}`
			})
		}];
		if (withPets) grids.push({
			tab: "pets",
			ids: pets,
			title: texts.petsTitle,
			checked: (id) => id === chosenMainPet,
			card: (id, x, y, checked) => petCard(id, x, y, {
				checked,
				attrs: `data-pet-card="${id}"`,
				starKey: `grid-p${id}`
			})
		});
		const slotX = (index) => GRID.padX + index % GRID.cols * GRID.step;
		const slotY = (index) => GRID.padY + Math.floor(index / GRID.cols) * GRID.rowStep;
		const cellHtml = (grid, id, index) => grid.card(id, slotX(index), slotY(index), grid.checked(id));
		const shownIds = (grid) => grid.tab === "heroes" && searchText.trim() ? grid.ids.filter((id) => nameMatches(unitName(id), searchText)) : grid.ids;
		const positionOf = (grid, id) => {
			const shown = shownIds(grid).indexOf(id);
			return shown >= 0 ? shown : grid.ids.indexOf(id);
		};
		const gridHtml = (grid) => {
			const cells = grid.ids.map((id, index) => win.part(`data-cell="${id}"`, cellHtml(grid, id, index))).join("");
			const rows = Math.ceil(grid.ids.length / GRID.cols);
			return label(grid.title, OX + GRID.x, 68, GRID.w, 30, 20, TEXT_COLORS.subHeader) + `<div class="nxList" style="left: ${OX + GRID.x}px; top: ${GRID.y}px; width: ${GRID.w + 12}px; height: ${GRID.h}px;"><div style="position: relative; height: ${GRID.padY + rows * GRID.rowStep}px;">${cells}</div></div>` + piece("gradientTop", OX + GRID.x, GRID.y - 2, {
				render: { width: GRID.w },
				cls: "nxNoHit",
				attrs: "data-fade=\"top\"",
				style: "opacity: 0;"
			}) + piece("gradientBot", OX + GRID.x, GRID.y + GRID.h - 56, {
				render: { width: GRID.w },
				cls: "nxNoHit",
				style: "opacity: 0.6;"
			});
		};
		const rowHtml = () => {
			let html = !withPets ? "" : chosenMainPet ? slotBase(OX + ROW.petX, ROW.y, true) + petCard(chosenMainPet, OX + ROW.petX, ROW.y, {
				attrs: "data-remove-mainpet=\"1\"",
				starKey: `row-p${chosenMainPet}`
			}) : emptySlot(OX + ROW.petX, ROW.y, "", true);
			const ids = rowTeam();
			const offset = TEAM_SIZE - ids.length;
			for (let index = 0; index < TEAM_SIZE; index++) {
				const x = OX + ROW.heroX + index * ROW.step;
				const id = index >= offset ? ids[index - offset] : 0;
				if (!id && index < TEAM_SIZE - limit) continue;
				if (!id) {
					html += emptySlot(x, ROW.y);
					continue;
				}
				const entry = team.get(id);
				html += slotBase(x, ROW.y) + heroCard(id, entry.rank, x, ROW.y, {
					attrs: `data-remove-hero="${id}"`,
					starKey: `row-${index}-${id}`
				});
				if (withPets) html += patronBadge(id, entry.pet, x + 66, ROW.y - 14);
				if (!showRanks) continue;
				ranks.forEach((r, k) => {
					const on = r.rank === entry.rank;
					html += `<div data-rank="${r.rank}" data-rank-hero="${id}" class="nxBox" title="${escapeAttr(r.title)}" style="left: ${x + 22 + k * 20}px; top: ${ROW.y + CARD + 6}px; width: 14px; height: 14px; border-radius: 50%; background: ${r.dot}; border: 2px solid ${on ? "#fff" : "rgba(0, 0, 0, 0.6)"}; box-shadow: ${on ? "0 0 5px #fff" : "none"};"></div>`;
				});
			}
			return html;
		};
		const buttonsHtml = () => mediumButton(win, "green", 792, ROW.y, texts.save, "data-save=\"1\"") + mediumButton(win, "boring", 792, ROW.y + BUTTON_STEP, texts.cancel, "data-close=\"1\"");
		const frameHtml = () => {
			const headerW = 440;
			const headerX = 465 - headerW / 2;
			return piece("underBGglow", 134, -84, {
				render: {
					scale: 2,
					renderScale: .5
				},
				cls: "nxNoHit"
			}) + piece("PopupBG_12_12_12_12", 160, 55, {
				render: {
					width: 610,
					height: 469
				},
				size: [610, 469],
				fallback: "background: #190e08; border-radius: 10px;"
			}) + piece("mainframeSep_64_64_2_2", 147, 41, {
				render: {
					width: 636,
					height: 491
				},
				size: [636, 491],
				fallback: "border: 3px solid #ce9767; border-radius: 12px;",
				cls: "nxNoHit"
			}) + piece("header_178_178_2", headerX, 14, {
				render: { width: headerW },
				size: [headerW, 56],
				fallback: "background: linear-gradient(180deg, #8a5a2a, #4a2a10); border-radius: 10px;",
				cls: "nxNoHit"
			}) + label(texts.title, 325, 14, 280, 56, 24, TEXT_COLORS.title) + piece("closeButton_32", 740, 26, {
				size: [46, 46],
				fallback: "background: #8a1c12; border: 2px solid #ce9767; border-radius: 50%; color: #fff; font: 700 20px/42px sans-serif; text-align: center;",
				inner: "✕",
				attrs: "data-close=\"1\"",
				cls: "nxBox"
			});
		};
		const statsHtml = (stats) => {
			const font = gameFont(16, true);
			const step = font ? font.lineHeight * 16 / font.size : 15;
			const top = 50 - Math.round(stats.length * step / 2);
			return stats.map((stat, index) => label(stat, 101, top + index * step, 226, step, 16, TEXT_COLORS.stats, "", { place: "top" })).join("");
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
			const slot = TEAM_SIZE - ids.length + Math.max(0, ids.indexOf(heroId));
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
				if (petId === own) status = piece("iconvsmall", 122, 76, {
					render: {
						width: 25,
						height: 23
					},
					size: [25, 23],
					fallback: "color: #5fe02a; font: 700 20px/23px sans-serif;",
					inner: "✔",
					cls: "nxNoHit"
				}) + label(texts.patronChosen, 101, 72, 219, 28, 20, TEXT_COLORS.chosen) + piece("clan_member_dismiss_button", 290, 72, {
					size: [31, 31],
					fallback: "background: #6a4526; border-radius: 50%;",
					attrs: `data-patron-remove="1" title="${escapeAttr(texts.patronRemove)}"`,
					cls: "nxBox"
				});
				else if (owner) status = piece("team_gather_select_favor_label_busy", 95, 70, { cls: "nxNoHit" }) + label(escapeAttr(texts.patronBusy(unitName(owner))), 102.95, 74, 226, 19, 20, TEXT_COLORS.busy, "", { place: "top" });
				else status = label(texts.patronFree, 100, 74, 226, 19, 20, TEXT_COLORS.free, "", { place: "top" });
				items += `<div data-patron-pick="${petId}" class="nxBox nxItem" style="left: ${ix}px; top: ${iy}px; width: ${ITEM.w}px; height: ${ITEM.h}px;">` + piece("cutePanel_BG_12_12_12_12", 0, 0, {
					render: {
						width: ITEM.w,
						height: ITEM.h
					},
					size: [ITEM.w, ITEM.h],
					fallback: "background: #2a1a10; border: 1px solid #ce976766; border-radius: 10px;",
					cls: "nxIdle"
				}) + piece("cutePanelActive_BG_12_12_12_12", 0, 0, {
					render: {
						width: ITEM.w,
						height: ITEM.h
					},
					size: [ITEM.w, ITEM.h],
					fallback: "background: #3a2414; border: 1px solid #ce9767; border-radius: 10px;",
					cls: "nxHover"
				}) + petCard(petId, 7, 9, { starKey: `patron-${petId}` }) + label(escapeAttr(unitName(petId)), 101, 9, 226, 19, 20, TEXT_COLORS.petName, "", { place: "top" }) + statsHtml(stats) + status + `<div class="nxP ${pic(`s${petId}`, skillIcons[petId])}" style="left: 333px; top: 21px; width: 72px; height: 72px; background-color: #1b1f45; border-radius: 3px;"></div>` + piece("border_item_purple", 327, 15, { cls: "nxNoHit" }) + "</div>";
			});
			if (!fitting.length) items = label(texts.patronNone, ITEM.left, ITEM.top + 40, ITEM.w, 30, 18, TEXT_COLORS.free);
			const headerW = Math.min(W - 60, 515);
			return "<div style=\"position: absolute; inset: 0; z-index: 20;\">" + win.cover("popup_bg_bitmap", "background: rgba(0, 0, 0, 0.45);", "data-patron-dim=\"1\"") + `<div data-patron-box="1" style="position: absolute; left: ${px}px; top: ${py}px; width: ${W}px; height: ${H}px;">` + piece("titan_tooltip_bg", 0, 0, {
				render: {
					width: W,
					height: H
				},
				size: [W, H],
				fallback: "background: #190e08; border: 3px solid #ce9767; border-radius: 10px;"
			}) + piece("titan_toolip_pointer", heroCenter - px - 16, H - 7, { cls: "nxNoHit" }) + piece("team_gather_select_favor_header_back", (W - headerW) / 2, 36, {
				render: { width: headerW },
				cls: "nxNoHit"
			}) + label(texts.patronTitle, 40, 12, W - 80, 36, 24, TEXT_COLORS.patronHeader) + piece("closeButton_32", W - 35, -15, {
				size: [46, 46],
				fallback: "background: #8a1c12; border: 2px solid #ce9767; border-radius: 50%; color: #fff; font: 700 20px/42px sans-serif; text-align: center;",
				inner: "✕",
				attrs: "data-patron-close=\"1\"",
				cls: "nxBox"
			}) + items + "</div></div>";
		};
		const tabsHtml = () => tabHtml("heroes", texts.tabHeroes, 181) + (withPets ? tabHtml("pets", texts.tabPets, 229) : "");
		const SEARCH = {
			w: 210,
			h: 28,
			y: 67
		};
		const searchHtml = () => {
			if (!texts.search || tab !== "heroes") return "";
			const left = OX + GRID.x + GRID.w - SEARCH.w;
			return `<style>.nxSearchInput::placeholder { color: #b89a74; opacity: 1; }</style><input data-search type="text" class="nxSearchInput" value="${escapeAttr(searchText)}" placeholder="${escapeAttr(texts.search)}" autocomplete="off" spellcheck="false" style="position: absolute; left: ${left}px; top: ${SEARCH.y}px; width: ${SEARCH.w}px; height: ${SEARCH.h}px; box-sizing: border-box; padding: 0 28px 0 12px; border: 2px solid #ce9767; border-radius: 14px; background: rgba(25, 14, 8, 0.92); color: #fbe0ac; font: 600 15px sans-serif; outline: none; z-index: 2;"><div data-search-clear class="nxBox" style="left: ${left + SEARCH.w - 26}px; top: ${SEARCH.y + 4}px; width: 20px; height: 20px; display: ${searchText ? "block" : "none"}; color: #fbe0ac; font: 700 18px/20px sans-serif; text-align: center; cursor: pointer; z-index: 3;">×</div>`;
		};
		const messageHtml = () => label(message, OX + GRID.x, 496, GRID.w, 26, 16, "#ffb347");
		const teamKey = () => JSON.stringify([[...team], chosenMainPet]);
		const built = new Set();
		const gridReady = (grid) => built.has(grid.tab) || grid.tab === tab;
		const gridShown = (grid) => {
			if (!gridReady(grid) || built.has(grid.tab)) return;
			built.add(grid.tab);
			for (const id of grid.ids) shownChecks.set(id, grid.checked(id));
			watchGrid(grid);
		};
		const parts = [
			{
				name: "frame",
				key: () => "",
				html: frameHtml
			},
			{
				name: "tabs",
				key: () => tab,
				html: tabsHtml
			},
			{
				name: "search",
				key: () => texts.search && tab === "heroes" ? texts.search : "",
				html: searchHtml,
				after: () => bindSearch()
			},
			...grids.map((grid) => ({
				name: `grid-${grid.tab}`,
				key: () => gridReady(grid) ? "ready" : "",
				html: () => gridReady(grid) ? gridHtml(grid) : "",
				after: () => gridShown(grid)
			})),
			{
				name: "message",
				key: () => message,
				html: messageHtml
			},
			{
				name: "row",
				key: teamKey,
				html: rowHtml
			},
			{
				name: "buttons",
				key: () => "",
				html: buttonsHtml
			},
			{
				name: "patron",
				key: () => patronFor ? `${patronFor}:${teamKey()}` : "",
				html: patronHtml
			}
		];
		const shownKeys = new Map();
		const shownChecks = new Map();
		const gridPart = (grid) => stage.querySelector(`[data-part="grid-${grid.tab}"]`);
		const showTab = () => {
			for (const grid of grids) {
				const el = gridPart(grid);
				if (el) el.style.visibility = grid.tab === tab ? "" : "hidden";
			}
		};
		const visibleCells = (grid, list) => {
			const top = list.scrollTop - GRID.padY;
			const first = Math.max(0, Math.floor((top - 22) / GRID.rowStep) + 1);
			const last = Math.ceil((top + GRID.h + 18) / GRID.rowStep) - 1;
			return shownIds(grid).slice(first * GRID.cols, (last + 1) * GRID.cols).map((id) => stage.querySelector(`[data-cell="${id}"]`)).filter((cell) => cell !== null);
		};
		const quietScroll = new WeakSet();
		const watchGrid = (grid) => {
			const el = gridPart(grid);
			const list = el?.querySelector(".nxList");
			if (!el || !list) return;
			const fade = el.querySelector("[data-fade=\"top\"]");
			const syncFade = () => {
				if (fade) fade.style.opacity = list.scrollTop > 0 ? "0.6" : "0";
			};
			let frame = false;
			let timer = 0;
			let queue = [];
			const paintNext = () => {
				let row = [];
				while (!row.length && queue.length) row = queue.splice(0, GRID.cols).filter((cell) => cell.isConnected);
				if (!row.length) return;
				win.paintTexts(row);
				timer = window.setTimeout(paintNext, 0);
			};
			list.addEventListener("scroll", () => {
				if (!frame) {
					frame = true;
					requestAnimationFrame(() => {
						frame = false;
						syncFade();
					});
				}
				if (quietScroll.delete(list)) return;
				clearTimeout(timer);
				queue = [];
				timer = window.setTimeout(() => {
					queue = visibleCells(grid, list);
					paintNext();
				}, SCROLL_SETTLE_MS);
			}, { passive: true });
			win.onClose(() => clearTimeout(timer));
			syncFade();
		};
		const renderAll = () => {
			let html = "";
			for (const part of parts) {
				shownKeys.set(part.name, part.key());
				html += win.part(`data-part="${part.name}"`, part.html());
			}
			win.render(html);
			for (const part of parts) part.after?.();
			showTab();
			win.paintTexts();
		};
		const update = () => {
			const changed = [];
			for (const part of parts) {
				const key = part.key();
				if (shownKeys.get(part.name) === key) continue;
				const el = stage.querySelector(`[data-part="${part.name}"]`);
				if (!el) continue;
				win.render(part.html(), el);
				shownKeys.set(part.name, key);
				changed.push(el);
				part.after?.();
			}
			for (const grid of grids) grid.ids.forEach((id) => {
				const checked = grid.checked(id);
				if (shownChecks.get(id) === checked) return;
				const cell = stage.querySelector(`[data-cell="${id}"]`);
				if (!cell) return;
				win.render(cellHtml(grid, id, positionOf(grid, id)), cell);
				shownChecks.set(id, checked);
				changed.push(cell);
			});
			showTab();
			if (changed.length) win.paintTexts(changed);
		};
		const applySearch = () => {
			const clear = stage.querySelector("[data-search-clear]");
			if (clear) clear.style.display = searchText ? "block" : "none";
			const grid = grids[0];
			const list = gridPart(grid)?.querySelector(".nxList");
			if (!list) return;
			const shown = shownIds(grid);
			const place = new Map(shown.map((id, index) => [id, index]));
			for (const id of grid.ids) {
				const cell = stage.querySelector(`[data-cell="${id}"]`);
				if (!cell) continue;
				const index = place.get(id);
				cell.style.display = index === void 0 ? "none" : "contents";
				const card = cell.firstElementChild;
				if (index === void 0 || !card) continue;
				card.style.left = `${slotX(index)}px`;
				card.style.top = `${slotY(index)}px`;
			}
			const body = list.firstElementChild;
			if (body) body.style.height = `${GRID.padY + Math.ceil(shown.length / GRID.cols) * GRID.rowStep}px`;
			if (list.scrollTop) {
				quietScroll.add(list);
				list.scrollTop = 0;
			}
			win.paintTexts(visibleCells(grid, list));
		};
		const bindSearch = () => {
			const input = stage.querySelector("[data-search]");
			if (!input) return;
			input.addEventListener("input", () => {
				searchText = input.value;
				applySearch();
			});
			for (const type of [
				"keydown",
				"keyup",
				"keypress"
			]) input.addEventListener(type, (event) => event.stopPropagation());
		};
		const resetScroll = () => {
			for (const grid of grids) {
				const list = gridPart(grid)?.querySelector(".nxList");
				if (!list?.scrollTop) continue;
				quietScroll.add(list);
				list.scrollTop = 0;
				win.paintTexts(visibleCells(grid, list));
			}
		};
		let session = null;
		let closed = false;
		win.onClose(() => {
			closed = true;
			session?.(null);
		});
		const onKey = (event) => {
			if (event.key !== "Escape") return;
			event.stopPropagation();
			event.preventDefault();
			if (event.type !== "keyup") return;
			const input = stage.querySelector("[data-search]");
			if (input && event.target === input && searchText) {
				searchText = "";
				input.value = "";
				applySearch();
				return;
			}
			if (patronFor) {
				patronFor = 0;
				update();
			} else session?.(null);
		};
		win.root.addEventListener("click", (event) => {
			const finish = (value) => session?.(value);
			const at = (selector) => event.target.closest(selector);
			let el;
			if (patronFor) {
				if (el = at("[data-patron-remove]")) {
					const entry = team.get(patronFor);
					if (entry) entry.pet = 0;
					patronFor = 0;
					update();
					return;
				}
				if (el = at("[data-patron-pick]")) {
					const petId = Number(el.dataset.patronPick);
					for (const entry of team.values()) if (entry.pet === petId) entry.pet = 0;
					const entry = team.get(patronFor);
					if (entry) entry.pet = petId;
					patronFor = 0;
					update();
					return;
				}
				if (at("[data-patron-close]") || !at("[data-patron-box]")) {
					patronFor = 0;
					update();
				}
				return;
			}
			if (el = at("[data-search-clear]")) {
				const input = stage.querySelector("[data-search]");
				searchText = "";
				if (input) {
					input.value = "";
					input.focus();
				}
				applySearch();
				return;
			}
			if (el = at("[data-patron]")) {
				patronFor = Number(el.dataset.patron);
				update();
				return;
			}
			if (el = at("[data-rank]")) {
				const entry = team.get(Number(el.dataset.rankHero));
				if (entry) entry.rank = Number(el.dataset.rank);
				update();
				return;
			}
			if (el = at("[data-close]")) {
				finish(null);
				return;
			}
			if (el = at("[data-save]")) {
				if (team.size === 0) {
					message = texts.needOne;
					update();
					return;
				}
				const picked = sortedTeam().map((id) => ({
					id,
					rank: team.get(id).rank,
					pet: team.get(id).pet
				}));
				const error = validate?.(picked, chosenMainPet) ?? null;
				if (error) {
					message = error;
					update();
					return;
				}
				finish({
					team: picked,
					mainPet: chosenMainPet
				});
				return;
			}
			if (el = at("[data-tab]")) {
				tab = el.dataset.tab;
				message = "";
				update();
				return;
			}
			if (el = at("[data-remove-mainpet]")) {
				chosenMainPet = 0;
				message = "";
				update();
				return;
			}
			if (el = at("[data-remove-hero]")) {
				team.delete(Number(el.dataset.removeHero));
				message = "";
				update();
				return;
			}
			if (el = at("[data-hero-card]")) {
				const id = Number(el.dataset.heroCard);
				if (team.has(id)) {
					team.delete(id);
					message = "";
				} else if (team.size >= limit && limit === 1) {
					team.clear();
					team.set(id, {
						rank: firstRank.rank,
						pet: 0
					});
					message = "";
				} else if (team.size >= limit) message = texts.full;
				else {
					team.set(id, {
						rank: firstRank.rank,
						pet: 0
					});
					message = "";
				}
				update();
				return;
			}
			if (el = at("[data-pet-card]")) {
				const id = Number(el.dataset.petCard);
				chosenMainPet = id === chosenMainPet ? 0 : id;
				message = "";
				update();
			}
		});
		let rendered = false;
		const open = ({ team: initial, mainPet = 0, texts: openTexts, validate: openValidate }) => {
			activeSession?.(null);
			team.clear();
			for (const entry of initial) team.set(entry.id, {
				rank: entry.rank,
				pet: entry.pet
			});
			chosenMainPet = withPets ? Number(mainPet) || 0 : 0;
			tab = "heroes";
			message = "";
			patronFor = 0;
			texts = openTexts;
			validate = openValidate;
			const hadSearch = Boolean(searchText);
			searchText = "";
			const input = stage.querySelector("[data-search]");
			if (input) input.value = "";
			return new Promise((resolve) => {
				let done = false;
				const finish = (value) => {
					if (done) return;
					done = true;
					window.removeEventListener("keydown", onKey, true);
					window.removeEventListener("keyup", onKey, true);
					if (session === finish) session = null;
					if (activeSession === finish) activeSession = null;
					win.hide();
					resolve(value);
				};
				session = finish;
				activeSession = finish;
				window.addEventListener("keydown", onKey, true);
				window.addEventListener("keyup", onKey, true);
				if (!rendered) {
					rendered = true;
					renderAll();
				} else {
					win.show();
					update();
					if (hadSearch) applySearch();
					resetScroll();
				}
			});
		};
		return {
			signature,
			open,
			alive: () => !closed
		};
	}
	var SQUAD_PICKER_ID = "nxSquadPicker";
	var LIST_PICKER_ID = "nxListPicker";
	function eventHeroes() {
		return getEventHeroIds().filter((id) => heroById(id)).sort((a, b) => unitName(a).localeCompare(unitName(b)));
	}
	function eventPets() {
		const petLib = getPetLib();
		return getEventPetIds().filter((id) => petLib[id]).sort((a, b) => unitName(a).localeCompare(unitName(b)));
	}
	function pickerRanks() {
		return RANKS.map((r) => ({
			rank: r.rank,
			art: rankCardArt(r),
			dot: r.dot,
			title: I18N(r.key)
		}));
	}
	function pickerTexts(title) {
		return {
			title,
			tabHeroes: I18N("NX_PICK_TAB_HEROES"),
			tabPets: I18N("NX_PICK_TAB_PETS"),
			heroesTitle: I18N("NX_PICK_HEROES_TITLE"),
			search: I18N("NX_PICK_SEARCH"),
			petsTitle: I18N("NX_PICK_PETS_TITLE"),
			save: I18N("NX_PICK_SAVE"),
			cancel: I18N("NX_CANCEL"),
			needOne: I18N("NX_PICK_NEED"),
			full: I18N("NX_PICK_FULL"),
			patronAdd: I18N("NX_PATRON_ADD"),
			patronTitle: I18N("NX_PATRON_TITLE"),
			patronChosen: I18N("NX_PATRON_CHOSEN"),
			patronRemove: I18N("NX_PATRON_REMOVE"),
			patronBusy: (hero) => I18N("NX_PATRON_BUSY", { hero }),
			patronFree: I18N("NX_PATRON_FREE"),
			patronNone: I18N("NX_PATRON_NONE")
		};
	}
	var teamString = (team) => team.map((e) => `${e.id}/${e.rank}/${e.pet || "-"}`).join(", ");
	async function openHeroListPicker(heroes, title, max = NX_TEAM_SIZE, withRanks = false, windowId = LIST_PICKER_ID) {
		const ids = eventHeroes();
		const limit = Math.max(1, Math.min(NX_TEAM_SIZE, max));
		const team = new Map();
		for (const item of heroes) {
			const id = Number(item.id);
			const rank = withRanks ? rankOf(Number(item.rank ?? 1)).rank : RANKS[0].rank;
			if (ids.includes(id) && team.size < limit) team.set(id, {
				id,
				rank,
				pet: 0
			});
		}
		const result = await openUnitPicker({
			id: windowId,
			heroes: ids,
			limit,
			ranks: pickerRanks(),
			showRanks: withRanks,
			petArt: EVENT_PET_ART,
			team: [...team.values()],
			texts: pickerTexts(title)
		});
		if (!result) return null;
		return {
			heroIds: result.team.map((e) => e.id),
			ranks: Object.fromEntries(result.team.map((e) => [e.id, e.rank]))
		};
	}
	async function openSquadPicker(teamRaw, mainPet) {
		const parsed = String(teamRaw ?? "").trim() ? parseArchdemonNewTeam(teamRaw) : null;
		const team = parsed?.kind === "team" ? parsed.heroes.map((id) => ({
			id,
			rank: rankOf(parsed.targets[id]).rank,
			pet: Number(parsed.favor[id] ?? 0)
		})) : [];
		const result = await openUnitPicker({
			id: SQUAD_PICKER_ID,
			heroes: eventHeroes(),
			pets: eventPets(),
			limit: NX_TEAM_SIZE,
			ranks: pickerRanks(),
			showRanks: true,
			petArt: EVENT_PET_ART,
			team,
			mainPet: Number(mainPet) || 0,
			texts: pickerTexts(I18N("NX_PICK_TITLE")),
			validate: (picked) => {
				const verdict = parseArchdemonNewTeam(teamString(picked));
				return verdict.kind === "error" ? verdict.error : null;
			}
		});
		if (!result) return null;
		return {
			teamRaw: teamString(result.team),
			mainPet: result.mainPet
		};
	}
	var petId = (n) => n > 0 && n < 100 ? 6e3 + n : n;
	function readCache$1(storage) {
		try {
			const cached = JSON.parse(storage.getItem(NX_PRESETS_STORAGE_KEY) ?? "null");
			return cached && Array.isArray(cached.data) ? cached : null;
		} catch {
			return null;
		}
	}
	function writeCache$1(storage, data, now) {
		try {
			storage.setItem(NX_PRESETS_STORAGE_KEY, JSON.stringify({
				exp: now + NX_PRESETS_TTL_MS,
				data
			}));
		} catch (e) {
			console.error(e);
		}
	}
	var PresetsClient = class {
		options;
		constructor(options = {}) {
			this.options = options;
		}
		async loadRows({ force = false } = {}) {
			const { storage = globalThis.localStorage, clock = Date.now, fetchImpl = globalThis.fetch, urls = NX_PRESETS_URLS } = this.options;
			const now = clock();
			const cached = storage ? readCache$1(storage) : null;
			if (cached && cached.exp > now && !force && cached.data.length) return {
				rows: cached.data,
				source: "cache"
			};
			const errors = [];
			for (const url of mirrorOrder(storage, urls)) try {
				const data = await fetchRows(fetchImpl, url);
				if (storage) {
					writeCache$1(storage, data, now);
					rememberMirror(storage, url);
				}
				return {
					rows: data,
					source: "network",
					url
				};
			} catch (e) {
				console.error(`Сборки: зеркало ${url} не ответило`, e);
				errors.push(`${new URL(url).hostname}: ${String(e?.message ?? e)}`);
			}
			const error = errors.join("; ") || "нет зеркал";
			if (cached) return {
				rows: cached.data,
				source: "stale",
				error
			};
			return {
				rows: [],
				source: "none",
				error
			};
		}
		forceWait() {
			const { storage = globalThis.localStorage, clock = Date.now } = this.options;
			const now = clock();
			let last = null;
			try {
				const raw = storage?.getItem(NX_PRESETS_FORCE_KEY);
				last = raw == null ? null : Number(raw);
			} catch {
				last = null;
			}
			if (last == null || !Number.isFinite(last)) return 0;
			return Math.max(0, last + NX_PRESETS_FORCE_INTERVAL_MS - now);
		}
		markForced() {
			const { storage = globalThis.localStorage, clock = Date.now } = this.options;
			const now = clock();
			try {
				storage?.setItem(NX_PRESETS_FORCE_KEY, String(now));
			} catch (e) {
				console.error(e);
			}
		}
		async load(buff, { force = false } = {}) {
			const loaded = await this.loadRows({ force });
			const presets = [];
			let dropped = 0;
			for (const row of loaded.rows) {
				const preset = decodePresetRow(row);
				const parsed = preset && validatePreset(preset);
				if (!parsed) {
					dropped++;
					continue;
				}
				presets.push({
					...preset,
					parsed
				});
			}
			if (dropped) console.log(`Сборки: не подошли текущему событию или испорчены ${dropped} из ${loaded.rows.length}`);
			return {
				presets: sortPresets(presets, buff),
				source: loaded.source,
				error: loaded.error,
				dropped
			};
		}
	};
	async function fetchRows(fetchImpl, url) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), NX_PRESETS_TIMEOUT_MS);
		let response;
		try {
			response = await fetchImpl(url, {
				signal: controller.signal,
				cache: "no-cache"
			});
		} finally {
			clearTimeout(timer);
		}
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data = await response.json();
		if (!Array.isArray(data)) throw new Error("ответ не массив");
		return data;
	}
	function mirrorOrder(storage, urls = NX_PRESETS_URLS) {
		let last = null;
		try {
			last = storage?.getItem(NX_PRESETS_MIRROR_KEY) ?? null;
		} catch {
			last = null;
		}
		return urls.includes(last) ? [last, ...urls.filter((u) => u !== last)] : [...urls];
	}
	function rememberMirror(storage, url) {
		try {
			storage.setItem(NX_PRESETS_MIRROR_KEY, url);
		} catch (e) {
			console.error(e);
		}
	}
	function decodePresetRow(row) {
		if (!Array.isArray(row) || row.length < 9) return null;
		const [author, videoType, videoId, damage, buff, coins, talismans, mainPet, heroes] = row;
		if (typeof author !== "string") return null;
		if (!Array.isArray(talismans) || talismans.length !== 2 || !talismans.every(Number.isInteger)) return null;
		if (!Array.isArray(heroes) || !heroes.length || heroes.length % 3 || heroes.length > 15 || !heroes.every(Number.isInteger)) return null;
		const blocks = [];
		for (let i = 0; i < heroes.length; i += 3) {
			const [hero, rank, patron] = heroes.slice(i, i + 3);
			if (![
				1,
				3,
				7
			].includes(rank)) return null;
			blocks.push(`${hero}/${rank}/${patron ? petId(patron) : "-"}`);
		}
		const video = NX_PRESET_VIDEO[videoType];
		return {
			author: author.trim().slice(0, 40),
			videoUrl: video && typeof videoId === "string" && video.id.test(videoId) ? video.prefix + videoId : null,
			damage: Number.isFinite(damage) && damage > 0 ? damage : 0,
			buff: Number.isInteger(buff) && buff >= 0 ? buff : 0,
			coins: Number.isInteger(coins) && coins > 0 ? coins : 0,
			talismanIds: talismans.map(Number),
			mainPet: Number.isInteger(mainPet) && mainPet > 0 ? petId(mainPet) : 0,
			teamRaw: blocks.join(", ")
		};
	}
	function validatePreset(preset) {
		const parsed = parseArchdemonNewTeam(preset.teamRaw);
		if (parsed.kind === "error") return null;
		const pets = getEventPetIds();
		if (preset.mainPet && pets.length && !pets.includes(preset.mainPet)) return null;
		const all = talismanTable();
		const [first, second] = preset.talismanIds;
		const usable = (id, roll) => {
			const talisman = Object.values(all).find((e) => Number(e.id) === id);
			return Boolean(talisman) && emblemDrops(talisman) && !NX_EXCLUDED_TALISMAN_IDS.includes(id) && (roll === 1 || !talisman.firstChoiceOnly);
		};
		if (first === second || !usable(first, 1) || !usable(second, 2)) return null;
		return parsed;
	}
	function sortPresets(list, buff) {
		return [...list].sort((a, b) => {
			return (a.buff === buff ? 0 : 1) - (b.buff === buff ? 0 : 1) || a.buff - b.buff || b.damage - a.damage;
		});
	}
	function presetCarry(buff) {
		return Number(buff) >= NX_PRESET_STRONG_BUFF ? {
			carry: [...NX_PRESET_STRONG_CARRY],
			sacrifice: NX_PRESET_STRONG_SACRIFICE
		} : {
			carry: [...NX_PRESET_CARRY],
			sacrifice: NX_PRESET_SACRIFICE
		};
	}
	function presetSetup(preset, { chapterId, chapterNumber = 0, keepExtraCoins = false, buff = preset.buff }) {
		const { carry, sacrifice } = presetCarry(buff);
		const parsed = preset.parsed ?? parseArchdemonNewTeam(preset.teamRaw);
		const targetPercent = preset.coins ? coinsToPercent(preset.coins) : 0;
		return {
			chapterId,
			chapterNumber,
			heroes: parsed.heroes,
			targets: parsed.targets,
			favor: parsed.favor,
			favorPets: parsed.favorPets,
			mainPet: preset.mainPet,
			petsToCollect: [...new Set([...parsed.favorPets, preset.mainPet].filter(Boolean))],
			talismanId: preset.talismanIds[0],
			talismanIds: [...preset.talismanIds],
			minCoins: targetPercent ? minCoinsForPercent(targetPercent) : null,
			presetPercent: targetPercent || null,
			keepExtraCoins,
			carryHeroes: carry,
			carryTargets: Object.fromEntries(carry.map((id) => [id, 1])),
			carryExtraHeroes: [],
			startRefreshes: 0,
			sacrificeHeroes: [sacrifice],
			sacrificeRefreshes: 0,
			sacrificePoint: NX_PRESET_SACRIFICE_POINT,
			pauseAfterBoss: false,
			buyAnyRandomLots: false,
			skipRandomLots: true,
			stopIfIncomplete: false,
			preset: {
				author: preset.author,
				damage: preset.damage,
				buff: preset.buff,
				coins: preset.coins
			}
		};
	}
	var STAGES = {
		alpha: 0,
		beta: 1,
		rc: 2
	};
	function parseVersion(version) {
		const m = /^\s*(\d+)\.(\d+)(?:\.(\d+))?(?:-([a-z]+))?/i.exec(String(version ?? ""));
		if (!m) return null;
		const stage = m[4] ? STAGES[m[4].toLowerCase()] ?? 0 : 3;
		return [
			Number(m[1]),
			Number(m[2]),
			Number(m[3] ?? 0),
			stage
		];
	}
	function isNewer(candidate, current) {
		const a = parseVersion(candidate);
		const b = parseVersion(current);
		if (!a || !b) return false;
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
		return false;
	}
	function versionFromHeader(text) {
		return /\/\/\s*@version\s+(\S+)/.exec(text)?.[1] ?? null;
	}
	function readCache(storage) {
		try {
			const cached = JSON.parse(storage?.getItem(NX_UPDATE_STORAGE_KEY) ?? "null");
			return cached && Number.isFinite(cached.exp) ? cached : null;
		} catch {
			return null;
		}
	}
	function writeCache(storage, cache) {
		try {
			storage?.setItem(NX_UPDATE_STORAGE_KEY, JSON.stringify(cache));
		} catch (e) {
			console.error(e);
		}
	}
	async function fetchVersion(fetchImpl, url) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), NX_PRESETS_TIMEOUT_MS);
		try {
			const response = await fetchImpl(url, {
				headers: { Range: `bytes=0-1023` },
				cache: "no-store",
				signal: controller.signal
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const version = versionFromHeader(await response.text());
			if (!version) throw new Error("нет @version в шапке");
			return version;
		} finally {
			clearTimeout(timer);
		}
	}
	async function checkForUpdate(options = {}) {
		const { storage = globalThis.localStorage, clock = Date.now, fetchImpl = globalThis.fetch, urls = NX_UPDATE_URLS } = options;
		const now = clock();
		const cached = readCache(storage);
		if (cached && cached.exp > now) return cached.version;
		for (const url of urls) try {
			const version = await fetchVersion(fetchImpl, url);
			writeCache(storage, {
				exp: now + NX_UPDATE_TTL_MS,
				version
			});
			return version;
		} catch (e) {
			console.log(`Проверка версии: ${new URL(url).hostname} не ответил`, e);
		}
		writeCache(storage, {
			exp: now + NX_UPDATE_RETRY_MS,
			version: null
		});
		return null;
	}
	function availableUpdate(current, storage = globalThis.localStorage) {
		const version = readCache(storage)?.version ?? null;
		return isNewer(version, current) ? version : null;
	}
	function onGamePage() {
		return typeof location !== "undefined" && typeof fetch === "function" && /(^|\.)(hero-wars\.com|hero-wars\.cn|fbsbx\.com)$/.test(location.hostname);
	}
	function talismanIconUrl(library, talismanId, size) {
		const icon = talismanById(talismanId)?.clientData?.icon;
		return icon ? renderGui(library, icon, {
			file: "emblem_icons",
			width: size,
			height: size
		})?.url ?? "" : "";
	}
	function slotHtml(url, name, frame, size, border) {
		const inner = url ? `<img src="${url}" alt="" style="width: 100%; height: 100%; display: block; border-radius: 2px; background: #1b1f45; box-shadow: 0 0 0 1px rgba(20, 8, 30, 0.6);">` : "<div style=\"width: 100%; height: 100%; background: #1b1f45; border-radius: 2px;\"></div>";
		return `<div title="${escapeAttr(name)}" style="position: relative; width: ${size}px; height: ${size}px; padding: ${border}px; box-sizing: border-box; border-radius: 4px; background: ${frame}; box-shadow: 0 0 1px rgba(0, 0, 0, 0.7);">${inner}`;
	}
	function gameSlotHtml(library, url, name, frameSymbol, size, { octagon = false, round = false, empty = false, bg = "" } = {}) {
		const frame = renderGui(library, frameSymbol, round ? {
			width: size,
			height: size
		} : {});
		if (!frame) return null;
		const k = round ? 1 : size / 96;
		const inset = Math.round(round ? size * .14 : (octagon ? 6 : 8) * k);
		const clip = octagon ? `clip-path: ${OCTAGON};` : round ? "border-radius: 50%;" : "border-radius: 3px;";
		const back = bg ? renderGui(library, bg, {
			width: size - 2 * inset,
			height: size - 2 * inset
		}) : null;
		const backHtml = back ? `<img src="${back.url}" alt="" style="position: absolute; left: ${inset}px; top: ${inset}px; width: ${size - 2 * inset}px; height: ${size - 2 * inset}px; ${clip}">` : "";
		const inner = url ? backHtml + `<img src="${url}" alt="" style="position: absolute; left: ${inset}px; top: ${inset}px; width: ${size - 2 * inset}px; height: ${size - 2 * inset}px;${back ? "" : " background: #1b1f45;"} ${clip}">` : empty ? "" : `<div style="position: absolute; left: ${inset}px; top: ${inset}px; width: ${size - 2 * inset}px; height: ${size - 2 * inset}px; background: #190e08; ${clip}"></div>`;
		return `<div title="${escapeAttr(name)}" style="position: relative; width: ${size}px; height: ${size}px; flex: none;">${inner}<img src="${frame.url}" alt="" style="position: absolute; left: ${frame.x * k}px; top: ${frame.y * k}px; width: ${frame.width * k}px; height: ${frame.height * k}px;">`;
	}
	function framedSlotHtml(library, url, name, frameSymbol, cssFrame, size, border, opts) {
		return gameSlotHtml(library, url, name, frameSymbol, size, opts) ?? slotHtml(url, name, cssFrame, size, border);
	}
	function editButtonHtml(id, hint, label = I18N("NX_SQUAD_EDIT")) {
		return `<div id="${id}" class="PopUp_btnSocket" title="${escapeAttr(hint)}" style="margin-left: auto; flex: none;"><div class="PopUp_btnRow"><div class="PopUp_btnGap green"><div class="PopUp_btnPlate">` + label + "</div></div></div></div>";
	}
	var GUI_FILES = [PET_HEAD_FILE, "emblem_icons"];
	var SIZE = 36;
	var TALISMAN = 30;
	var COL = {
		damage: 88,
		buff: 66,
		coins: 60,
		talismans: 72,
		pet: 58
	};
	var PLAY_ICON = "<svg width=\"32\" height=\"23\" viewBox=\"0 0 24 17\" aria-hidden=\"true\" style=\"display: block;\"><rect width=\"24\" height=\"17\" rx=\"4\" fill=\"#e53935\"/><path d=\"M9.5 4.5v8l7-4z\" fill=\"#fff\"/></svg>";
	var muted = (text) => `<span style="opacity: 0.6;">${text}</span>`;
	var link = (url, name) => `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" style="color: #ffcf84;">${escapeAttr(name)}</a>`;
	var linkItem = (url, name, about) => `<div style="margin-left: 10px;">• ${link(url, name)} — ${about}</div>`;
	var REFRESH_BUTTON = "<div id=\"nxPresetsRefresh\" role=\"button\" style=\"flex: none; width: 30px; height: 30px; border-radius: 50%; border: 2px solid #88cb13; color: #88cb13; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; line-height: 1; user-select: none;\">↻</div>";
	function readKeepExtraCoins() {
		const saved = getSaveVal(NX_SAVE_KEYS.keepExtraCoins, false);
		return saved === true || saved === "true";
	}
	function headerHtml(buff) {
		const sites = NX_PRESET_SITES.map((site) => linkItem(site.url, site.name, I18N(site.key))).join("");
		return `<div style="font-size: 22px; color: #ffcf84; margin: 2px 0 8px;">${I18N("NX_PRESETS_BUFF", { buff: `<span style="color: LimeGreen;">${Number(buff) || 0}</span>` })}</div><div style="margin-top: 6px; line-height: 1.5;">${I18N("NX_PRESETS_SOURCES")}${sites}</div><div style="margin-top: 8px;">${I18N("NX_PRESETS_AUTHORS")}</div>`;
	}
	function presetsWaitHtml(tr) {
		const lang = tr("NX_LANG") === "ru" ? "ru" : "en";
		const { telegram, youtube, sites } = NX_PRESETS_WAIT_LINKS;
		const heading = (text) => `<div style="margin-top: 14px; font-size: 14px; color: #c9b89c;">${text}</div>`;
		return `<div style="line-height: 1.5;">${tr("NX_PRESETS_WAIT_SOON")}</div><div style="margin-top: 10px; line-height: 1.5;">${tr("NX_PRESETS_WAIT_RESOURCES")}</div><div style="line-height: 1.5;">` + heading("Telegram") + telegram[lang].map((group) => linkItem(group.url, group.name, tr(group.key))).join("") + heading(tr("NX_PRESETS_WAIT_YOUTUBE")) + `<div style="margin-left: 10px;">${youtube.map((channel) => link(channel.url, channel.name)).join(" · ")}</div>` + heading(tr("NX_PRESETS_WAIT_SITES")) + sites.map((site) => linkItem(site.url, site.name, tr(site.key))).join("") + "</div>";
	}
	function keepCoinsHtml() {
		return `<div class="PopUp_ContCheckbox" style="margin-top: 14px;"><input type="checkbox" class="PopUp_checkbox" id="nxKeepExtraCoins"${readKeepExtraCoins() ? " checked" : ""}><label for="nxKeepExtraCoins" title="${escapeAttr(I18N("NX_PRESETS_KEEP_COINS_HINT"))}">${I18N("NX_PRESETS_KEEP_COINS")}</label></div>`;
	}
	function columnsHtml() {
		const cell = (width, key, align = "center") => `<div style="width: ${width}px; flex: none; text-align: ${align};">${I18N(key)}</div>`;
		return "<div style=\"display: flex; align-items: flex-end; gap: 6px; font-size: 13px; color: #c9b89c; margin-top: 8px; padding-bottom: 4px;\">" + cell(COL.damage, "NX_PRESETS_HEAD_DAMAGE", "right") + cell(COL.buff, "NX_PRESETS_HEAD_BUFF") + cell(COL.coins, "NX_PRESETS_HEAD_COINS") + cell(COL.talismans, "NX_PRESETS_HEAD_TALISMANS") + cell(COL.pet, "NX_PRESETS_HEAD_PET") + cell(192, "NX_PRESETS_HEAD_HEROES") + `<div style="flex: 1; min-width: 60px;">${I18N("NX_PRESETS_HEAD_AUTHOR")}</div></div>`;
	}
	function presetRowHtml(preset, index, ctx) {
		const { library, heroIcons, petIcons, buff } = ctx;
		const slot = (...args) => framedSlotHtml(library, ...args) + "</div>";
		const heroes = preset.parsed.heroes.map((id) => ({
			id,
			fragments: preset.parsed.targets[id],
			pet: Number(preset.parsed.favor[id] ?? 0)
		})).sort((a, b) => battleOrder(b.id) - battleOrder(a.id)).map((hero) => {
			const rank = rankOf(hero.fragments);
			const head = hero.pet ? renderGui(library, petHeadSymbol(hero.pet), {
				file: "pet_icons",
				width: 17,
				height: 17
			}) : null;
			const patron = head ? `<img src="${head.url}" alt="" title="${escapeAttr(unitName(hero.pet))}" style="position: absolute; top: -6px; right: -4px; width: 17px; height: 17px;">` : "";
			return framedSlotHtml(library, heroIcons[hero.id], unitName(hero.id), rank.gameFrame, frameFor(hero.fragments), SIZE, 3, { bg: rank.gameBg }) + patron + "</div>";
		}).join("");
		const pet = preset.mainPet ? slot(petIcons[preset.mainPet], unitName(preset.mainPet), PET_GAME_ART.frame, SQUAD_FRAMES.purple, SIZE, 3, {
			octagon: true,
			bg: PET_GAME_ART.bg
		}) : `<div title="${escapeAttr(I18N("NX_PRESETS_NO_PET"))}" style="width: ${SIZE}px; height: ${SIZE}px; flex: none; text-align: center; line-height: ${SIZE}px; opacity: 0.5;">—</div>`;
		const talismans = preset.talismanIds.map((id) => {
			const url = talismanIconUrl(library, id, TALISMAN);
			const title = escapeAttr(emblemName(id));
			return url ? `<img src="${url}" alt="" title="${title}" style="width: ${TALISMAN}px; height: ${TALISMAN}px; margin: 0 -6px; flex: none;">` : `<div title="${title}" style="width: 18px; flex: none;">?</div>`;
		}).join("");
		const authorText = preset.author ? escapeAttr(preset.author) : muted(I18N("NX_PRESETS_UNKNOWN_AUTHOR"));
		const author = preset.videoUrl ? `<a href="${escapeAttr(preset.videoUrl)}" target="_blank" rel="noopener noreferrer" style="color: #ffcf84;">${authorText}</a>` : authorText;
		const video = preset.videoUrl ? `<a href="${escapeAttr(preset.videoUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(I18N("NX_PRESETS_VIDEO"))}" style="flex: none;">${PLAY_ICON}</a>` : "";
		const matched = preset.buff === Number(buff);
		return `<div style="display: flex; align-items: center; gap: 6px; padding: 5px 0; border-top: 1px solid rgba(206, 151, 103, 0.25);"><div style="width: ${COL.damage}px; flex: none; text-align: right; font-size: 18px; font-weight: bold; white-space: nowrap;">${I18N("NX_PRESETS_BILLION", { value: preset.damage })}</div><div style="width: ${COL.buff}px; flex: none; text-align: center; font-size: 13px;${matched ? " color: LimeGreen; font-weight: bold;" : ""}">${preset.buff || "—"}</div><div style="width: ${COL.coins}px; flex: none; text-align: center; font-size: 13px;">${preset.coins || "—"}</div><div style="display: flex; width: ${COL.talismans}px; flex: none; justify-content: center;">${talismans}</div><div style="display: flex; width: ${COL.pet}px; flex: none; justify-content: center;">${pet}</div><div style="display: flex; gap: 3px; flex: none;">${heroes}</div><div style="flex: 1; min-width: 60px; display: flex; align-items: center; gap: 6px; overflow: hidden;"><span style="min-width: 0; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttr(preset.author)}">${author}</span>${video}</div>` + editButtonHtml(`nxPresetGo${index}`, goHint(buff), I18N("NX_PRESETS_GO")) + "</div>";
	}
	function goHint(buff) {
		const { carry, sacrifice } = presetCarry(buff);
		return I18N("NX_PRESETS_GO_HINT", {
			carry: carry.map(unitName).join(", "),
			sacrifice: unitName(sacrifice),
			point: NX_PRESET_SACRIFICE_POINT
		});
	}
	async function openPresetsView({ root, form, buff, setButtonsVisible, onGo, client = new PresetsClient() }) {
		root.querySelector("#nxPresetsView")?.remove();
		const view = document.createElement("div");
		view.id = "nxPresetsView";
		view.className = "PopUp_text";
		view.setAttribute("style", "text-align: left; max-width: 820px; font-size: 16px;");
		view.innerHTML = `<div data-part="top" style="display: none;">${headerHtml(buff)}${keepCoinsHtml()}</div><div data-part="list" style="margin-top: 6px;">${I18N("NX_PRESETS_LOADING")}</div><div data-part="error" style="color: #ff6b6b; margin-top: 10px; min-height: 1px;"></div><div style="display: flex; align-items: center; gap: 10px; margin-top: 12px;">` + REFRESH_BUTTON.replace("role=\"button\"", `role="button" title="${escapeAttr(I18N("NX_PRESETS_REFRESH"))}"`) + "<span data-part=\"refresh-note\" style=\"font-size: 13px; opacity: 0.8;\"></span>" + editButtonHtml("nxPresetsBack", "", I18N("NX_PRESETS_BACK")) + "</div>";
		form.style.display = "none";
		setButtonsVisible(false);
		root.append(view);
		const close = () => {
			view.remove();
			form.style.display = "";
			setButtonsVisible(true);
		};
		view.querySelector("#nxPresetsBack")?.addEventListener("click", close);
		const keep = view.querySelector("#nxKeepExtraCoins");
		keep?.addEventListener("change", () => setSaveVal(NX_SAVE_KEYS.keepExtraCoins, keep.checked));
		const list = view.querySelector("[data-part=\"list\"]");
		const error = view.querySelector("[data-part=\"error\"]");
		const note = view.querySelector("[data-part=\"refresh-note\"]");
		const top = view.querySelector("[data-part=\"top\"]");
		const refresh = view.querySelector("#nxPresetsRefresh");
		const showTable = (visible) => {
			if (top) top.style.display = visible ? "" : "none";
			if (refresh) refresh.style.display = visible ? "flex" : "none";
			if (note) note.style.display = visible ? "" : "none";
		};
		showTable(false);
		let busy = false;
		view.querySelector("#nxPresetsRefresh")?.addEventListener("click", handleAsync(async () => {
			if (busy) return;
			const wait = client.forceWait();
			if (wait > 0) {
				if (note) note.textContent = I18N("NX_PRESETS_REFRESH_WAIT", { seconds: Math.ceil(wait / 1e3) });
				return;
			}
			client.markForced();
			if (note) note.textContent = "";
			busy = true;
			try {
				await renderList(true);
			} finally {
				busy = false;
			}
		}));
		await renderList(false);
		return close;
		async function renderList(force) {
			if (!list) return;
			list.innerHTML = I18N("NX_PRESETS_LOADING");
			if (error) error.innerHTML = "";
			const loaded = await client.load(Number(buff) || 0, { force });
			if (!view.isConnected) return;
			if (!loaded.presets.length) {
				if (loaded.source === "none") {
					showTable(true);
					list.innerHTML = `<div style="color: #ffb347;">${I18N("NX_PRESETS_ERROR")}</div><div style="font-size: 12px; margin-top: 4px; opacity: 0.7;">${escapeAttr(loaded.error)}</div>`;
					return;
				}
				showTable(false);
				list.innerHTML = presetsWaitHtml(I18N);
				return;
			}
			const heroIds = [...new Set(loaded.presets.flatMap((p) => p.parsed.heroes))];
			const petIds = [...new Set(loaded.presets.flatMap((p) => [p.mainPet, ...p.parsed.favorPets]).filter(Boolean))];
			const [library, heroIcons, petIcons] = await Promise.all([
				loadGameGui(GUI_FILES),
				loadHeroIcons(heroIds),
				loadUnitIcons(petIds)
			]);
			if (!view.isConnected) return;
			const ctx = {
				library,
				heroIcons,
				petIcons,
				buff
			};
			showTable(true);
			list.innerHTML = (loaded.source === "stale" ? `<div style="font-size: 13px; color: #ffb347;">${I18N("NX_PRESETS_STALE")}</div>` : "") + columnsHtml() + loaded.presets.map((preset, index) => presetRowHtml(preset, index, ctx)).join("");
			loaded.presets.forEach((preset, index) => {
				view.querySelector(`#nxPresetGo${index}`)?.addEventListener("click", () => {
					const problem = onGo(preset, keep ? keep.checked : readKeepExtraCoins());
					if (problem && error) error.innerHTML = problem;
				});
			});
		}
	}
	var SETUP_GUI_FILES = [PET_HEAD_FILE, "emblem_icons"];
	var NO_PACE = () => Promise.resolve();
	function section(title, hint) {
		return `<div style="text-align: left; margin: 14px 0 4px; font-size: 19px; color: #ffcf84;">${title}` + (hint ? `<div style="font-size: 13px; color: #d8cbb8; opacity: 0.85;">${hint}</div>` : "") + "</div>";
	}
	function savedSacrificePointChoice() {
		const saved = Number(getSaveVal(NX_SAVE_KEYS.sacrificePoint, NX_SACRIFICE_POINTS[0]));
		return NX_SACRIFICE_POINTS.includes(saved) ? saved : NX_SACRIFICE_POINTS[0];
	}
	function savedChoice() {
		const talismansRaw = getSaveVal(NX_SAVE_KEYS.talismans, [Number(getSaveVal(NX_SAVE_KEYS.talisman, 0))]);
		return {
			team: String(getSaveVal(NX_SAVE_KEYS.team, "")),
			mainPet: Number(getSaveVal(NX_SAVE_KEYS.mainPet, 0)),
			talismans: (Array.isArray(talismansRaw) ? talismansRaw : [talismansRaw]).map(Number),
			carry: String(getSaveVal(NX_SAVE_KEYS.carry, "")),
			sacrifice: (parseIdList(String(getSaveVal(NX_SAVE_KEYS.sacrifice, ""))) ?? []).slice(0, NX_SACRIFICE_CANDIDATES).join(", ")
		};
	}
	function setupTalismans() {
		return allTalismans().filter((e) => !NX_EXCLUDED_TALISMAN_IDS.includes(Number(e.id)) && emblemDrops(e));
	}
	function rowIconUrl(library, talismanId) {
		return talismanIconUrl(library, talismanId, 30);
	}
	async function heroIconsPaced(ids, pace) {
		const icons = {};
		for (const id of ids) {
			await pace();
			Object.assign(icons, await loadHeroIcons([id]));
		}
		return icons;
	}
	async function prepareSetupWindow(pace) {
		const library = await loadGameGui(SETUP_GUI_FILES);
		for (const talisman of setupTalismans()) {
			await pace();
			rowIconUrl(library, Number(talisman.id));
		}
		const saved = savedChoice();
		await squadHtml(saved.team, saved.mainPet, saved.talismans, pace);
		await heroListHtml(parseRankedIdList(saved.carry) ?? [], "nxCarryEdit", "", pace);
		await heroListHtml(parseRankedIdList(saved.sacrifice) ?? [], "nxSacrificeEdit", "", pace);
	}
	function talismanSlotsHtml(library, talismanIds) {
		return talismanIds.map((id) => {
			const url = id ? talismanIconUrl(library, id, 58) : "";
			return url ? `<img src="${url}" alt="" title="${escapeAttr(emblemName(id))}" style="width: 58px; height: 58px; margin: 0 -9px; flex: none;">` : `<div title="${escapeAttr(I18N("NX_ANY_TALISMAN"))}" style="width: 40px; height: 40px; margin: 9px 0; flex: none; border-radius: 50%; box-sizing: border-box; border: 2px dashed rgba(206, 151, 103, 0.45);"></div>`;
		}).join("");
	}
	function versionLabelHtml(version, update) {
		const current = `<span style="opacity: 0.6;">v${escapeAttr(version)}</span>`;
		const button = `<a href="${NX_GREASYFORK_URL}" target="_blank" rel="noopener" title="${escapeAttr(I18N("NX_UPDATE_HINT"))}" style="display: inline-flex; padding: 0 1px 3px; border-radius: 4px; text-decoration: none; cursor: pointer; background: hsl(120, 60%, 10%); box-shadow: 0 0 2px 0 hsl(36, 88%, 7%), 0 -1px 2px 0 hsl(36, 88%, 7%), 0 1px 1px 0 hsl(120, 60%, 12%);"><span style="display: flex; align-items: center; justify-content: center; height: 16px; padding: 0 9px; border-radius: 3px; background: hsl(120, 60%, 50%); color: hsl(120, 60%, 90%); font: 700 11px Arial, sans-serif; letter-spacing: 0.3px; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.92);">${escapeAttr(I18N("NX_UPDATE_BUTTON"))}</span></a>`;
		return `<span style="position: absolute; left: 14px; top: 1px; display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 14px; white-space: nowrap;">${current}${update ? `<span style="color: LimeGreen;">· ${escapeAttr(I18N("NX_UPDATE_SHORT", { version: update }))}</span>${button}` : ""}</span>`;
	}
	async function archdemonNewSetup(chapters, buffAmount, relicLevel) {
		const library = await loadGameGui(SETUP_GUI_FILES);
		const savedChapter = Number(getSaveVal(NX_SAVE_KEYS.chapter, 0));
		const choice = savedChoice();
		let currentTeam = choice.team;
		let currentMainPet = choice.mainPet;
		const savedTalismans = choice.talismans;
		const rollBosses = getTalismanRollBosses(chapters[0]?.id ?? 0);
		const savedMinCoins = String(getSaveVal(NX_SAVE_KEYS.minCoins, ""));
		let currentCarry = choice.carry;
		let currentSacrifice = choice.sacrifice;
		const savedSacrificeRefreshes = String(getSaveVal(NX_SAVE_KEYS.sacrificeRefreshes, "0"));
		const savedStartRefreshes = String(getSaveVal(NX_SAVE_KEYS.startRefreshes, "0"));
		const savedPauseRaw = getSaveVal(NX_SAVE_KEYS.pause, false);
		const savedPause = savedPauseRaw === true || savedPauseRaw === "true";
		const savedRandomAnyRaw = getSaveVal(NX_SAVE_KEYS.randomAny, false);
		const savedRandomAny = savedRandomAnyRaw === true || savedRandomAnyRaw === "true";
		const savedStopIncompleteRaw = getSaveVal(NX_SAVE_KEYS.stopIncomplete, false);
		const savedStopIncomplete = savedStopIncompleteRaw === true || savedStopIncompleteRaw === "true";
		const savedSacrificePoint = savedSacrificePointChoice();
		const talismanRowsFor = (rollNumber) => setupTalismans().filter((e) => rollNumber === 1 || !e.firstChoiceOnly).map((e) => {
			let description = "";
			try {
				const buff = allAdventureBuffs().find((b) => b.id === e.effectConfig.buffId);
				description = buff ? cheats.translate(`${buff.localeId}_DESC`) : "";
			} catch (err) {
				console.error(err);
			}
			return {
				id: Number(e.id),
				name: emblemName(e.id),
				description,
				icon: rowIconUrl(library, Number(e.id))
			};
		}).sort((a, b) => a.name.localeCompare(b.name));
		const radioRow = (group, value, label, checked, title) => `<div class="PopUp_ContCheckbox"><input type="checkbox" class="PopUp_checkbox hwhNewRadio radio_hwhNew_${group}" data-group="${group}" data-value="${escapeAttr(value)}" id="hwhNew_${group}_${escapeAttr(value)}"${checked ? " checked" : ""}><label for="hwhNew_${group}_${escapeAttr(value)}" title="${escapeAttr(title)}">${label}</label></div>`;
		let html = "<div id=\"nxSetupForm\" class=\"PopUp_text\" style=\"text-align: left; width: 600px; max-width: 100%;\"><style>.PopUp_Container:has(#nxSetupForm) { scrollbar-gutter: stable; }</style>";
		const columns = (count, rows, fill = "row") => `<div style="display: grid; grid-template-columns: repeat(${count}, minmax(0, 1fr)); column-gap: 18px; align-items: start;` + (fill === "column" ? ` grid-auto-flow: column; grid-template-rows: repeat(${rows}, auto);` : "") + "\">";
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
			if (!chapterAvailable[chapter.id]) label += "<br>" + I18N("NX_NEED_RELIC", {
				relicName: getAbyssRelicName(),
				needLevel: chapterNeedLevel[chapter.id],
				haveLevel: relicLevel
			});
			label += "</span>";
			html += radioRow("chapter", chapter.id, label, chapter === preselected, "");
		});
		const initialTalismans = rollBosses.map((bossNumber, index) => {
			const saved = Number(savedTalismans[index] ?? 0);
			return saved !== 0 && !talismanRowsFor(index + 1).some((e) => e.id === saved) ? 0 : saved;
		});
		html += "<div id=\"nxSquadBlock\">" + await squadHtml(currentTeam, currentMainPet, initialTalismans) + "</div>";
		html += `<div style="display: flex; align-items: center; gap: 8px; margin-top: 10px;"><div style="flex: 1; font-size: 15px; color: #ffcf84;"><span style="color: LimeGreen; font-weight: bold;">New!</span> ${I18N("NX_PRESETS_LINE")}</div>` + editButtonHtml("nxPresetsOpen", I18N("NX_PRESETS_BUTTON_HINT"), I18N("NX_PRESETS_BUTTON")) + "</div>";
		html += columns(rollBosses.length);
		rollBosses.forEach((bossNumber, index) => {
			const rollNumber = index + 1;
			const rows = talismanRowsFor(rollNumber);
			const saved = initialTalismans[index];
			html += "<div>";
			html += section(I18N("NX_BLOCK_TALISMAN_POINT", {
				rollNumber,
				bossNumber
			}), "");
			const group = `talisman${rollNumber}`;
			const iconSpace = (url) => url ? `<img src="${url}" alt="" style="width: 30px; height: 30px; vertical-align: middle; margin: -8px 5px -8px 0;">` : "<span style=\"display: inline-block; width: 35px;\"></span>";
			html += radioRow(group, 0, iconSpace("") + I18N("NX_ANY_TALISMAN"), saved === 0, "");
			rows.forEach((talisman) => {
				html += radioRow(group, talisman.id, iconSpace(talisman.icon) + talisman.name, talisman.id === saved, talisman.description);
			});
			html += "</div>";
		});
		html += "</div>";
		html += "<div id=\"hwhNewWealthNote\" style=\"text-align: left; margin: 16px 0 0; font-size: 14px; color: #ffcf84;\">" + I18N("NX_WEALTH_ONLY_NOTE") + "</div>";
		html += `<div id="hwhNewDefaultBlock" class="PopUp_ContCheckbox" style="margin-top: 12px;"><input type="checkbox" class="PopUp_checkbox" id="hwhNewStopIncompleteInput"${savedStopIncomplete ? " checked" : ""}><label for="hwhNewStopIncompleteInput" title="${escapeAttr(I18N("NX_BLOCK_STOP_INCOMPLETE_HINT"))}">${I18N("NX_BLOCK_STOP_INCOMPLETE")}</label></div>`;
		html += "<div id=\"hwhNewWealthBlock\">";
		html += section(I18N("NX_BLOCK_CARRY"), I18N("NX_BLOCK_CARRY_HINT"));
		html += `<div id="nxCarryBlock">${await heroListHtml(parseRankedIdList(currentCarry) ?? [], "nxCarryEdit", I18N("NX_LIST_EDIT_HINT"))}</div>`;
		html += section(I18N("NX_BLOCK_START_REFRESH"), I18N("NX_BLOCK_START_REFRESH_HINT"));
		html += `<input type="text" id="hwhNewStartRefreshInput" class="PopUp_input" style="width: 100%; box-sizing: border-box;" title="${escapeAttr(I18N("NX_BLOCK_START_REFRESH_HINT"))}" placeholder="0" value="${escapeAttr(savedStartRefreshes)}">`;
		html += section(I18N("NX_BLOCK_SACRIFICE"), I18N("NX_BLOCK_SACRIFICE_HINT"));
		html += `<div id="nxSacrificeBlock">${await heroListHtml(parseRankedIdList(currentSacrifice) ?? [], "nxSacrificeEdit", I18N("NX_SACRIFICE_EDIT_HINT"))}</div>`;
		html += "<div id=\"nxSacrificeRefreshRow\">";
		html += section(I18N("NX_BLOCK_SACRIFICE_REFRESH"), I18N("NX_BLOCK_SACRIFICE_REFRESH_HINT"));
		html += `<input type="text" id="hwhNewSacrificeRefreshInput" class="PopUp_input" style="width: 100%; box-sizing: border-box;" title="${escapeAttr(I18N("NX_BLOCK_SACRIFICE_REFRESH_HINT"))}" placeholder="0" value="${escapeAttr(savedSacrificeRefreshes)}">`;
		html += "</div>";
		html += section(I18N("NX_BLOCK_SACRIFICE_POINT"), I18N("NX_BLOCK_SACRIFICE_POINT_HINT"));
		NX_SACRIFICE_POINTS.forEach((point) => {
			const label = point === 5 ? I18N("NX_SACRIFICE_POINT_5") : I18N("NX_SACRIFICE_POINT_7");
			html += radioRow("sacrificePoint", point, label, point === savedSacrificePoint, "");
		});
		html += section(I18N("NX_BLOCK_MIN_COINS", { coin: stallCoinName() }), I18N("NX_BLOCK_MIN_COINS_HINT"));
		html += `<div style="display: flex; align-items: center; gap: 12px;"><input type="text" id="hwhNewMinCoinsInput" class="PopUp_input" style="flex: 1; min-width: 0; box-sizing: border-box;" title="${escapeAttr(I18N("NX_BLOCK_MIN_COINS_HINT"))}" placeholder="${escapeAttr(I18N("NX_MIN_COINS_PLACEHOLDER"))}" value="${escapeAttr(savedMinCoins)}"><span id="nxMinCoinsBonus" style="flex: none; font-size: 14px; color: #ffcf84;">${minCoinsBonusText(savedMinCoins)}</span></div>`;
		html += `<div class="PopUp_ContCheckbox" style="margin-top: 12px;"><input type="checkbox" class="PopUp_checkbox" id="hwhNewRandomAnyInput"${savedRandomAny ? " checked" : ""}><label for="hwhNewRandomAnyInput" title="${escapeAttr(I18N("NX_BLOCK_RANDOM_ANY_HINT", { price: randomLotResale() }))}">${I18N("NX_BLOCK_RANDOM_ANY")}</label></div>`;
		html += `<div class="PopUp_ContCheckbox" style="margin-top: 6px;"><input type="checkbox" class="PopUp_checkbox" id="hwhNewPauseInput"${savedPause ? " checked" : ""}><label for="hwhNewPauseInput" title="${escapeAttr(I18N("NX_BLOCK_PAUSE_HINT"))}">${I18N("NX_BLOCK_PAUSE")}</label></div>`;
		html += "</div>";
		html += "<div id=\"hwhNewError\" style=\"color: #ff6b6b; text-align: left; margin-top: 12px; min-height: 1px;\"></div>";
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
			if (note) note.style.display = wealth ? "none" : "";
			const defaultBlock = popup.custom.querySelector("#hwhNewDefaultBlock");
			if (defaultBlock) defaultBlock.style.display = wealth ? "none" : "";
		};
		const repaintTalismans = () => {
			const chosen = {};
			popup.custom.querySelectorAll("input.hwhNewRadio[data-group^=\"talisman\"]:checked").forEach((cb) => {
				chosen[cb.dataset.group] = Number(cb.dataset.value);
			});
			popup.custom.querySelectorAll("input.hwhNewRadio[data-group^=\"talisman\"]").forEach((cb) => {
				const value = Number(cb.dataset.value);
				const takenNextDoor = value !== 0 && Object.entries(chosen).some(([group, id]) => group !== cb.dataset.group && id === value);
				const label = cb.nextElementSibling;
				if (label) label.style.opacity = takenNextDoor && !cb.checked ? "0.35" : "";
			});
		};
		const showError = (text) => {
			const box = popup.custom.querySelector("#hwhNewError");
			if (box) box.innerHTML = text;
		};
		const validate = () => {
			const chapterValue = readRadio("chapter");
			if (chapterValue === null) return {
				kind: "error",
				error: I18N("NX_ERR_NO_CHAPTER")
			};
			if (!chapterAvailable[Number(chapterValue)]) return {
				kind: "error",
				error: I18N("NX_NEED_RELIC", {
					relicName: getAbyssRelicName(),
					needLevel: chapterNeedLevel[Number(chapterValue)] ?? 0,
					haveLevel: relicLevel
				})
			};
			const teamRaw = currentTeam;
			if (!String(teamRaw).trim()) return {
				kind: "error",
				error: I18N("NX_ERR_SQUAD_EMPTY")
			};
			const parsed = parseArchdemonNewTeam(teamRaw);
			if (parsed.kind === "error") return {
				kind: "error",
				error: parsed.error
			};
			const mainPetValue = currentMainPet || 0;
			const talismanIds = [];
			for (let rollNumber = 1; rollNumber <= rollBosses.length; rollNumber++) {
				const value = readRadio(`talisman${rollNumber}`);
				if (value === null) return {
					kind: "error",
					error: I18N("NX_ERR_TALISMAN")
				};
				talismanIds.push(Number(value));
			}
			const picked = talismanIds.filter((e) => e !== 0);
			if (new Set(picked).size !== picked.length) return {
				kind: "error",
				error: I18N("NX_ERR_TALISMAN_DUP")
			};
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
				if (!parsedMinCoins) return {
					kind: "error",
					error: I18N("NX_ERR_MIN_COINS")
				};
				minCoins = parsedMinCoins.value;
				const carryList = parseRankedIdList(carryRaw);
				if (!carryList || carryList.length > NX_TEAM_SIZE) return {
					kind: "error",
					error: I18N("NX_ERR_CARRY")
				};
				carryHeroes = carryList.map((e) => e.id);
				carryTargets = Object.fromEntries(carryList.map((e) => [e.id, e.rank]));
				const carryError = carryPointOneError({
					chapterId: Number(chapterValue),
					carryHeroes,
					carryExtraHeroes
				});
				if (carryError) return {
					kind: "error",
					error: carryError
				};
				sacrificeHeroes = parseIdList(sacrificeRaw);
				if (!sacrificeHeroes || sacrificeHeroes.length > NX_SACRIFICE_CANDIDATES) return {
					kind: "error",
					error: I18N("NX_ERR_SACRIFICE", { max: NX_SACRIFICE_CANDIDATES })
				};
				if (!sacrificeHeroes.some((id) => carryHeroes.includes(id)) && String(sacrificeRefreshesRaw).trim() !== "") {
					const parsedRefreshes = Number(String(sacrificeRefreshesRaw).trim());
					if (!Number.isInteger(parsedRefreshes) || parsedRefreshes < 0 || parsedRefreshes > NX_SACRIFICE_MAX_REFRESHES) return {
						kind: "error",
						error: I18N("NX_ERR_SACRIFICE_REFRESH", { max: NX_SACRIFICE_MAX_REFRESHES })
					};
					sacrificeRefreshes = parsedRefreshes;
				}
				if (String(startRefreshesRaw).trim() !== "") {
					const parsed = Number(String(startRefreshesRaw).trim());
					if (!Number.isInteger(parsed) || parsed < 0 || parsed > NX_POINT1_MAX_REFRESHES) return {
						kind: "error",
						error: I18N("NX_ERR_START_REFRESH", { max: NX_POINT1_MAX_REFRESHES })
					};
					startRefreshes = parsed;
				}
			}
			const pauseAfterBoss = popup.custom.querySelector("#hwhNewPauseInput")?.checked === true;
			const buyAnyRandomLots = popup.custom.querySelector("#hwhNewRandomAnyInput")?.checked === true;
			const stopIfIncompleteRaw = popup.custom.querySelector("#hwhNewStopIncompleteInput")?.checked === true;
			const mainPet = Number(mainPetValue);
			const chapterId = Number(chapterValue);
			return {
				kind: "setup",
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
					stopIfIncomplete: talismanId !== NX_WEALTH_TALISMAN_ID && stopIfIncompleteRaw,
					stopIfIncompleteRaw,
					sacrificePoint: Number(readRadio("sacrificePoint") ?? savedSacrificePoint),
					teamRaw: String(teamRaw).trim(),
					minCoinsRaw: String(minCoinsRaw).replace(/\s+/g, ""),
					carryRaw: String(carryRaw).trim(),
					startRefreshesRaw: String(startRefreshesRaw).trim(),
					sacrificeRaw: String(sacrificeRaw).trim(),
					sacrificeRefreshesRaw: String(sacrificeRefreshesRaw).trim()
				}
			};
		};
		return await popup.customPopup((answer) => {
			let answered = false;
			let stopWatching = () => {};
			const complete = (value) => {
				if (answered) return;
				answered = true;
				stopWatching();
				answer(value);
			};
			popup.custom.insertAdjacentHTML("beforeend", html);
			popup.setMsgText(I18N("NX_SETUP_MESSAGE") + versionLabelHtml(GM_info.script.version, availableUpdate(GM_info.script.version)));
			popup.custom.querySelectorAll("input.hwhNewRadio").forEach((checkbox) => {
				checkbox.addEventListener("change", function() {
					if (!this.checked) {
						this.checked = true;
						return;
					}
					popup.custom.querySelectorAll(`input.hwhNewRadio[data-group="${this.dataset.group}"]`).forEach((other) => {
						if (other !== this) other.checked = false;
					});
					if (this.dataset.group.startsWith("talisman")) {
						const value = Number(this.dataset.value);
						if (value !== 0) popup.custom.querySelectorAll("input.hwhNewRadio[data-group^=\"talisman\"]:checked").forEach((other) => {
							if (other === this || Number(other.dataset.value) !== value) return;
							other.checked = false;
							const any = popup.custom.querySelector(`input.hwhNewRadio[data-group="${other.dataset.group}"][data-value="0"]`);
							if (any) any.checked = true;
						});
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
			popup.addButton({
				msg: I18N("NX_START"),
				color: "green"
			}, () => {
				const result = validate();
				if (result.kind === "error") {
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
				setSaveVal(NX_SAVE_KEYS.stopIncomplete, result.value.stopIfIncompleteRaw);
				setSaveVal(NX_SAVE_KEYS.startRefreshes, result.value.startRefreshesRaw);
				setSaveVal(NX_SAVE_KEYS.sacrificePoint, result.value.sacrificePoint);
				popup.hide();
				complete(result.value);
			});
			function readTalismanIds() {
				return rollBosses.map((bossNumber, index) => Number(readRadio(`talisman${index + 1}`) ?? 0));
			}
			function refreshTalismanSlots() {
				const box = popup.custom.querySelector("#nxTalismanSlots");
				if (box) box.innerHTML = talismanSlotsHtml(library, readTalismanIds());
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
				popup.custom.querySelector("#nxSquadEdit")?.addEventListener("click", handleAsync(async () => {
					const picked = await openSquadPicker(currentTeam, currentMainPet);
					if (!picked) return;
					currentTeam = picked.teamRaw;
					currentMainPet = picked.mainPet;
					setSaveVal(NX_SAVE_KEYS.team, currentTeam);
					setSaveVal(NX_SAVE_KEYS.mainPet, currentMainPet);
					const block = popup.custom.querySelector("#nxSquadBlock");
					if (block) block.innerHTML = await squadHtml(currentTeam, currentMainPet, readTalismanIds());
					bindSquadEdit();
					setStartEnabled(isSquadReady(currentTeam));
					showError("");
				}));
			};
			bindSquadEdit();
			const syncSacrificeRefreshRow = () => {
				const row = popup.custom.querySelector("#nxSacrificeRefreshRow");
				if (!row) return;
				const sacrifice = parseIdList(currentSacrifice) ?? [];
				const carry = (parseRankedIdList(currentCarry) ?? []).map((e) => e.id);
				row.style.display = sacrifice.length > 0 && !sacrifice.some((id) => carry.includes(id)) ? "" : "none";
			};
			syncSacrificeRefreshRow();
			const bindListEdit = (buttonId, pickerId, blockId, title, getRaw, setRaw, saveKey, max, hint, withRanks) => {
				popup.custom.querySelector(`#${buttonId}`)?.addEventListener("click", handleAsync(async () => {
					const picked = await openHeroListPicker(parseRankedIdList(getRaw()) ?? [], title, max, withRanks, pickerId);
					if (!picked) return;
					setRaw(picked.heroIds.map((id) => withRanks ? `${id}/${picked.ranks[id]}` : id).join(", "));
					setSaveVal(saveKey, getRaw());
					const block = popup.custom.querySelector(`#${blockId}`);
					if (block) block.innerHTML = await heroListHtml(parseRankedIdList(getRaw()) ?? [], buttonId, hint);
					bindListEdit(buttonId, pickerId, blockId, title, getRaw, setRaw, saveKey, max, hint, withRanks);
					syncSacrificeRefreshRow();
					showError("");
				}));
			};
			bindListEdit("nxCarryEdit", "nxCarryPicker", "nxCarryBlock", I18N("NX_PICK_CARRY_TITLE"), () => currentCarry, (v) => currentCarry = v, NX_SAVE_KEYS.carry, NX_TEAM_SIZE, I18N("NX_LIST_EDIT_HINT"), true);
			bindListEdit("nxSacrificeEdit", "nxSacrificePicker", "nxSacrificeBlock", I18N("NX_PICK_SACRIFICE_TITLE"), () => currentSacrifice, (v) => currentSacrifice = v, NX_SAVE_KEYS.sacrifice, NX_SACRIFICE_CANDIDATES, I18N("NX_SACRIFICE_EDIT_HINT"), false);
			popup.addButton({
				msg: I18N("NX_CANCEL"),
				color: "red"
			}, () => {
				popup.hide();
				complete("cancel");
			});
			const cancelButton = popup.buttons[popup.buttons.length - 1];
			const setButtonsVisible = (visible) => {
				for (const button of [startButton, cancelButton]) if (button) button.style.display = visible ? "" : "none";
			};
			const goWithPreset = (preset, keepExtraCoins) => {
				const chapterValue = readRadio("chapter");
				if (chapterValue === null) return I18N("NX_ERR_NO_CHAPTER");
				const chapterId = Number(chapterValue);
				if (!chapterAvailable[chapterId]) return I18N("NX_NEED_RELIC", {
					relicName: getAbyssRelicName(),
					needLevel: chapterNeedLevel[chapterId] ?? 0,
					haveLevel: relicLevel
				});
				const value = presetSetup(preset, {
					chapterId,
					chapterNumber: chapterNumbers[chapterId] ?? 0,
					keepExtraCoins,
					buff: buffAmount
				});
				if (value.talismanId === NX_WEALTH_TALISMAN_ID && carryPointOneError(value)) return I18N("NX_PRESETS_CARRY_POINT1", { list: value.carryHeroes.map(unitLabel).join(", ") });
				popup.hide();
				complete(value);
				return null;
			};
			popup.custom.querySelector("#nxPresetsOpen")?.addEventListener("click", () => {
				const form = popup.custom.querySelector("#nxSetupForm");
				if (!form) return;
				openPresetsView({
					root: popup.custom,
					form,
					buff: buffAmount,
					setButtonsVisible,
					onGo: goWithPreset
				}).catch((e) => console.error(e));
			});
			popup.addButton({ isClose: true }, () => {
				popup.hide();
				complete("cancel");
			});
			popup.show();
			const form = popup.custom.querySelector("#nxSetupForm");
			if (form) stopWatching = watchGone(form, popup.custom, () => {
				console.log("Окно настройки закрыло другое окно помощника: считаем «Отменой»");
				complete("cancel");
			});
		});
	}
	function watchGone(form, parent, onGone) {
		if (typeof MutationObserver === "undefined") return () => {};
		const observer = new MutationObserver(() => {
			if (form.isConnected) return;
			observer.disconnect();
			onGone();
		});
		observer.observe(parent, { childList: true });
		return () => observer.disconnect();
	}
	async function squadHtml(teamRaw, mainPet, talismanIds, pace = NO_PACE) {
		const parsed = String(teamRaw ?? "").trim() ? parseArchdemonNewTeam(teamRaw) : {
			kind: "error",
			error: ""
		};
		const team = parsed.kind === "error" ? [] : parsed.heroes.map((id) => ({
			id,
			fragments: parsed.targets[id],
			pet: Number(parsed.favor[id] ?? 0)
		})).sort((a, b) => battleOrder(b.id) - battleOrder(a.id));
		const heroIds = team.map((e) => e.id);
		const [library, heroIcons, petIcons] = await Promise.all([
			loadGameGui(SETUP_GUI_FILES),
			heroIconsPaced(heroIds, pace),
			loadUnitIcons([mainPet, ...team.map((e) => e.pet)].filter(Boolean))
		]);
		const slot = (...args) => framedSlotHtml(library, ...args);
		await pace();
		let row = mainPet ? slot(petIcons[mainPet], unitName(mainPet), PET_GAME_ART.frame, SQUAD_FRAMES.purple, 58, 4, {
			octagon: true,
			bg: PET_GAME_ART.bg
		}) : slot("", "", "petEmptySlot", SQUAD_FRAMES.empty, 58, 4, { empty: true });
		row = `<div style="margin-right: 6px;">${row}</div></div>`;
		const offset = NX_TEAM_SIZE - team.length;
		for (let index = 0; index < NX_TEAM_SIZE; index++) {
			await pace();
			const hero = index >= offset ? team[index - offset] : null;
			if (!hero) {
				row += slot("", "", "emptySlot", SQUAD_FRAMES.empty, 58, 4, { empty: true }) + "</div>";
				continue;
			}
			const head = hero.pet ? renderGui(library, petHeadSymbol(hero.pet), {
				file: "pet_icons",
				width: 28,
				height: 28
			}) : null;
			const patron = !hero.pet ? "" : head ? `<img src="${head.url}" alt="" title="${escapeAttr(unitName(hero.pet))}" style="position: absolute; top: -9px; right: -5px; width: 28px; height: 28px;">` : `<div style="position: absolute; top: -8px; right: -8px;">` + slot(petIcons[hero.pet], unitName(hero.pet), "item_round_border_purple", SQUAD_FRAMES.purple, 26, 3, { round: true }) + "</div></div>";
			const rank = rankOf(hero.fragments);
			row += slot(heroIcons[hero.id], unitName(hero.id), rank.gameFrame, frameFor(hero.fragments), 58, 4, { bg: rank.gameBg }) + patron + "</div>";
		}
		const button = editButtonHtml("nxSquadEdit", I18N("NX_SQUAD_EDIT_HINT"));
		await pace();
		const talismans = `<div id="nxTalismanSlots" style="display: flex; gap: 2px; margin-left: 6px;">${talismanSlotsHtml(library, talismanIds)}</div>`;
		const hint = team.length > 0 ? "" : `<div style="margin-top: 8px; font-size: 14px; color: #ffb347;">${I18N("NX_SQUAD_REQUIRED")}</div>`;
		return section(I18N("NX_BLOCK_SQUAD"), "") + "<div style=\"display: flex; align-items: center; gap: 4px; padding-top: 8px;\">" + row + talismans + button + "</div>" + hint;
	}
	async function heroListHtml(items, buttonId, hint, pace = NO_PACE) {
		const list = [...items].slice(0, NX_TEAM_SIZE).sort((a, b) => battleOrder(b.id) - battleOrder(a.id));
		const heroIds = list.map((e) => e.id);
		const [library, heroIcons] = await Promise.all([loadGameGui(SETUP_GUI_FILES), heroIconsPaced(heroIds, pace)]);
		let row = "";
		for (const item of list.length ? list : [null]) {
			await pace();
			const id = item?.id ?? 0;
			const rank = rankOf(Number(item?.rank ?? 1));
			row += id ? framedSlotHtml(library, heroIcons[id], unitName(id), rank.gameFrame, rank.frame, 58, 4, { bg: rank.gameBg }) : framedSlotHtml(library, "", "", "emptySlot", SQUAD_FRAMES.empty, 58, 4, { empty: true });
			row += "</div>";
		}
		return "<div style=\"display: flex; align-items: center; gap: 8px; padding-top: 4px;\">" + row + editButtonHtml(buttonId, hint) + "</div>";
	}
	function stallCoinName() {
		const key = "LIB_COIN_NAME_1080";
		const name = cheats.translate(key);
		return name && name !== key ? name : I18N("NX_STALL_COIN");
	}
	function minCoinsBonusText(raw) {
		const value = parseMinCoins(raw)?.value;
		if (value == null) return "";
		return escapeAttr(I18N("NX_MIN_COINS_BONUS", {
			talisman: emblemName(NX_WEALTH_TALISMAN_ID),
			percent: coinsToPercent(value)
		}));
	}
	function isSquadReady(teamRaw) {
		if (!String(teamRaw ?? "").trim()) return false;
		return parseArchdemonNewTeam(teamRaw).kind === "team";
	}
	var running = null;
	async function attackArchdemonNew() {
		const release = running?.session.holdWindows();
		try {
			await chooseAndStart();
		} catch (e) {
			console.error(e);
			setProgress("", true);
			await popup.confirm(failureHtml(I18N("NX_START_FAILED", { version: GM_info.script.version }), e));
			syncGame();
		} finally {
			release?.();
		}
	}
	async function chooseAndStart() {
		const missing = missingHelperApi();
		if (missing.length) {
			await popup.confirm(I18N("NX_ERR_HELPER_OLD", {
				version: helperVersion,
				list: missing.join(", ")
			}));
			return;
		}
		const relicId = currentEvent()?.settings?.relicId;
		const relic = (await Caller.send("workshop_getInfo")).relics.find((e) => e.id == relicId);
		const relicLevel = Number(relic?.level ?? 0);
		const buffAmount = relicLevel <= 1 ? 0 : relicLevel * 10;
		const chapters = getAbyssChapters().filter((e) => !isPaidChapter(e.id));
		if (chapters.length === 0) {
			await popup.confirm(I18N("NX_ERR_NO_FREE_ABYSS"));
			return;
		}
		const setup = await archdemonNewSetup(chapters, buffAmount, relicLevel);
		if (setup === "cancel" || !setup) return;
		console.log("archdemonNewSetup ", JSON.stringify(setup));
		await startRun(setup);
	}
	async function replaceRunning(old) {
		old.windows.replacing();
		old.session.replace();
		if (!old.session.waitingForPlayer) await old.done;
	}
	async function startRun(setup) {
		const previous = running;
		const windows = new RunWindows();
		const session = new RunSession(windows);
		let finished = () => {};
		const current = {
			session,
			windows,
			done: new Promise((resolve) => finished = resolve)
		};
		running = current;
		try {
			if (previous) await replaceRunning(previous);
			if (session.replaced) return;
			await runArchdemonNewLoop(session, setup);
		} catch (e) {
			console.error(e);
			if (await session.notice(I18N("NX_FAILED", { version: GM_info.script.version }), e)) syncGame();
		} finally {
			finished();
			if (running === current) running = null;
		}
	}
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
					await popup.confirm(failureHtml(I18N("NX_START_FAILED", { version: GM_info.script.version }), e));
				}
			},
			color: "green"
		});
	}
	async function onClickArchdemonNewButton() {
		setCurrentEventId((await Caller.send("invasion_getInfo"))?.id ?? 0);
		const now = Date.now();
		const opened = allChapters().some((chapter) => chapter.invasionId === currentEventId() && chapterDate(chapter.startDate) <= now && !(chapterDate(chapter.endDate) <= now));
		if (!currentEventId() || !opened) {
			confShow(I18N("NX_NO_EVENT"));
			return;
		}
		if (!eventHasAbyss(currentEventId())) {
			confShow(I18N("NX_NO_ABYSS"));
			return;
		}
		await attackArchdemonNew();
	}
	function gameReady() {
		if (typeof lib === "undefined" || typeof selfGame === "undefined" || !selfGame) return false;
		return Boolean(lib?.data?.invasion?.chapter && selfGame["game.assets.storage.AssetStorage"]?.instance?.index);
	}
	function preloadEvent(now) {
		const event = openEventAt(now);
		return event && eventHasAbyss(Number(event.id)) ? event : null;
	}
	async function preloadWindows(now = Date.now) {
		for (let waited = 0; !gameReady(); waited += NX_PRELOAD_POLL_MS) {
			if (waited >= NX_PRELOAD_WAIT_MS) return;
			await sleep(NX_PRELOAD_POLL_MS);
		}
		await sleep(NX_PRELOAD_SETTLE_MS);
		const event = preloadEvent(now());
		if (!event) return;
		await prepareSetupWindow(() => idle(NX_PRELOAD_IDLE_MS)).catch((e) => console.error(e));
		const petLib = getPetLib();
		await preloadUnitPicker(getEventHeroIds(event).filter((id) => heroById(id)), getEventPetIds(event).filter((id) => petLib[id]));
	}
	var NX_STARTUP_API = [
		"addExtentionName",
		"i18nLangData",
		"othersPopupButtons"
	];
	function startAddon() {
		bindHelper();
		const missing = missingHelperApi().filter((name) => name !== "lib");
		const cannotStart = missing.some((name) => NX_STARTUP_API.includes(name));
		if (missing.length) console.log(`%cHWHArchdemonExt: HeroWarsHelper ${helperVersion} слишком старый, нет: ${missing.join(", ")}${cannotStart ? ". Дополнение не запущено" : ""}`, "color: red");
		if (cannotStart) {
			try {
				if (typeof setProgress === "function") setProgress(NX_OLD_HELPER_TEXT, NX_OLD_HELPER_NOTICE_MS);
			} catch (e) {
				console.error(e);
			}
			return;
		}
		addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);
		registerTexts();
		addMenuEntry();
		preloadWindows().catch((e) => console.error(e));
		if (onGamePage()) checkForUpdate().catch((e) => console.error(e));
	}
	var helperReady = () => typeof HWHClasses !== "undefined" && typeof HWHFuncs !== "undefined" && typeof HWHData !== "undefined";
	async function waitForHelper() {
		const tries = Math.ceil(NX_HELPER_WAIT_MS / NX_HELPER_POLL_MS);
		for (let i = 0; i < tries; i++) {
			if (helperReady()) return true;
			await sleep(NX_HELPER_POLL_MS);
		}
		return helperReady();
	}
	waitForHelper().then((found) => {
		if (!found) {
			console.log(`%cHWHArchdemonExt: HeroWarsHelper не найден за ${NX_HELPER_WAIT_MS / 1e3} с, дополнение не запущено`, "color: red");
			return;
		}
		startAddon();
	}).catch((e) => console.error(e));
})();

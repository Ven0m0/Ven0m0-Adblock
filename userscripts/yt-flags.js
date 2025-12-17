const _COMMENTS_NO_DELAY = true;

const _flagsToAssign = {
  desktop_delay_player_resizing: false,
  DISABLE_YT_IMG_DELAY_LOADING: true,
  web_animated_actions: false,
  web_animated_like: false,
  web_animated_like_lazy_load: false,
  web_animated_actions_v2: false,
  render_unicode_emojis_as_small_images: true,
  smartimation_background: false,
  kevlar_refresh_on_theme_change: false,
  // Disable cinematics (aka ambient lighting)
  kevlar_measure_ambient_mode_idle: false,
  kevlar_watch_cinematics_invisible: false,
  web_cinematic_theater_mode: false,
  web_cinematic_fullscreen: false,
  enable_cinematic_blur_desktop_loading: false,
  kevlar_watch_cinematics: false,
  web_cinematic_masthead: false,
  web_watch_cinematics_preferred_reduced_motion_default_disabled: false
};

const _NATIVE_CANVAS_ANIMATION = false; // for #cinematics
const _FIX_schedulerInstanceInstance = 2 | 4;
const _FIX_yt_player = true; // DONT CHANGE
const _FIX_Animation_n_timeline = true;
const _NO_PRELOAD_GENERATE_204 = false;
const _ENABLE_COMPUTEDSTYLE_CACHE = true;

const _FIX_paper_ripple_animate = true;

const _DO_createStampDomArrayFnE1_ = true; // added in 2025.02.11 - to improve stampDom responsiveness
const _DO_createStampDomArrayFnE1_noConstraintE = true;
const _DO_createStampDomArrayFnE1_nativeAppendD = true;
const _DO_createStampDomArrayFnF1_ = true;
const _FIX_VIDEO_PLAYER_MOUSEHOVER_EVENTS = true;

// https://greasyfork.org/en/scripts/470428-youtube-experiment-flags-tamer
const _DISABLE_CINEMATICS = false;
const _ENABLE_MINOR_CHAT_FEATURE_UPGRADE = true;
const _NO_ANIMATED_LIKE = false;

// YT live chat tweaks
// ==UserScript==
// @name
// @run-at              document-start
// @allFrames           true
// @inject-into         page
// @match               https://www.youtube.com/live_chat*
// @match               https://www.youtube.com/live_chat_replay*
const _DEBUG_skipLog001 = true;
const _USE_OPTIMIZED_ON_SCROLL_ITEMS = true;
const _ENABLE_NO_SMOOTH_TRANSFORM = true;
const _ENABLE_OVERFLOW_ANCHOR_PREFERRED = true;

// reuse yt components
const _ENABLE_FLAGS_REUSE_COMPONENTS = true;

// 0 - disable; 1- smallest; 2- largest (smaller images)
const _AUTHOR_PHOTO_SINGLE_THUMBNAIL = 1;
const _EMOJI_IMAGE_SINGLE_THUMBNAIL = 1;

const _DO_LINK_PREFETCH = true;
const _ENABLE_BASE_PREFETCHING = true;
const _ENABLE_PRELOAD_THUMBNAIL = true;
const _SKIP_PRELOAD_EMOJI = true;
const _CACHE_SHOW_CONTEXT_MENU_FOR_REOPEN = true;
const _ADVANCED_NOT_ALLOW_SCROLL_FOR_SHOW_CONTEXT_MENU = false; // pause auto scroll faster when the context menu is about to show
const _ENABLE_MUTEX_FOR_SHOW_CONTEXT_MENU = true; // avoid multiple requests on the same time

const _BOOST_MENU_OPENCHANGED_RENDERING = true;

const _TAP_ACTION_DURATION = 280;

const _INTERACTIVITY_BACKGROUND_ANIMATION = 1; // mostly for pinned message
// 0 = default Yt animation background [= no fix];
// 1 = disable default animation background [= keep special animation];
// 2 = disable all animation backgrounds [= no animation backbround]

const _USE_ADVANCED_TICKING = true; // added in Dec 2024 v0.66.0; need to ensure it would not affect the function if ticker design changed. to be reviewed
// << if USE_ADVANCED_TICKING >>
const _FIX_TIMESTAMP_FOR_REPLAY = true;
const _ATTEMPT_TICKER_ANIMATION_START_TIME_DETECTION = true; // MUST BE true
const _REUSE_TICKER = true; // for better memory control; currently it is only available in ADVANCED_TICKING; to be further reviewed
// << end >>

const _DISABLE_Translation_By_Google = true;

const _FASTER_ICON_RENDERING = true;

const _DELAY_FOCUSEDCHANGED = true;

const _fixChildrenIssue801 = true; // if __children801__ is set [fix polymer controller method extration for `.set()`]

const _FIX_ANIMATION_TICKER_TEXT_POSITION = true; // CSS fix; experimental; added in 2024.04.07
const _FIX_AUTHOR_CHIP_BADGE_POSITION = true;

const _REACTION_ANIMATION_PANEL_CSS_FIX = true;

const _FIX_UNKNOWN_BUG_FOR_OVERLAY = true;

const _FIX_MOUSEOVER_FN = true; // avoid onMouseOver_ being triggerd quite a lot

const _FIX_MEMORY_LEAKAGE_TICKER_ACTIONMAP = true; // To fix Memory Leakage in yt-live-chat-ticker-...-item-renderer
const _FIX_MEMORY_LEAKAGE_TICKER_STATSBAR = true; // To fix Memory Leakage in updateStatsBarAndMaybeShowAnimation
const _FIX_MEMORY_LEAKAGE_TICKER_TIMER = true; // To fix Memory Leakage in setContainerWidth, slideDown, collapse // Dec 2024 fix in advance tickering
const _FIX_MEMORY_LEAKAGE_TICKER_DATACHANGED_setContainerWidth = true; // To fix Memory Leakage due to _.ytLiveChatTickerItemBehavior.setContainerWidth()

const _MODIFY_EMIT_MESSAGES_FOR_BOOST_CHAT = true; // enabled for boost chat only; instant emit & no background flush

// unsure
kevlar_tuner_should_reuse_components = true;
EXPERIMENT_FLAGS.kevlar_tuner_should_reuse_components = true;
EXPERIMENT_FLAGS.kevlar_tuner_should_test_reuse_components = true;

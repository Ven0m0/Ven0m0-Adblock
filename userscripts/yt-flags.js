

  const COMMENTS_NO_DELAY = true;
  
  
const flagsToAssign = {
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


const NATIVE_CANVAS_ANIMATION = false; // for #cinematics
  const FIX_schedulerInstanceInstance = 2 | 4;
  const FIX_yt_player = true; // DONT CHANGE
  const FIX_Animation_n_timeline = true;
  const NO_PRELOAD_GENERATE_204 = false;
  const ENABLE_COMPUTEDSTYLE_CACHE = true;
  
 const FIX_paper_ripple_animate = true;
 
 
const DO_createStampDomArrayFnE1_ = true; // added in 2025.02.11 - to improve stampDom responsiveness
  const DO_createStampDomArrayFnE1_noConstraintE = true;
  const DO_createStampDomArrayFnE1_nativeAppendD = true;
  const DO_createStampDomArrayFnF1_ = true;
  const FIX_VIDEO_PLAYER_MOUSEHOVER_EVENTS = true;





// https://greasyfork.org/en/scripts/470428-youtube-experiment-flags-tamer
const DISABLE_CINEMATICS = false;
const ENABLE_MINOR_CHAT_FEATURE_UPGRADE = true;
const NO_ANIMATED_LIKE = false;


// YT live chat tweaks
// ==UserScript==
// @name
// @run-at              document-start
// @allFrames           true
// @inject-into         page
// @match               https://www.youtube.com/live_chat*
// @match               https://www.youtube.com/live_chat_replay*
const DEBUG_skipLog001 = true;
const USE_OPTIMIZED_ON_SCROLL_ITEMS = true; 
const ENABLE_NO_SMOOTH_TRANSFORM = true; 
const ENABLE_OVERFLOW_ANCHOR_PREFERRED = true; 

  // reuse yt components
  const ENABLE_FLAGS_REUSE_COMPONENTS = true;
  
 // 0 - disable; 1- smallest; 2- largest (smaller images)
  const AUTHOR_PHOTO_SINGLE_THUMBNAIL = 1;
  const EMOJI_IMAGE_SINGLE_THUMBNAIL = 1;
  
const DO_LINK_PREFETCH = true; 
const ENABLE_BASE_PREFETCHING = true;
const ENABLE_PRELOAD_THUMBNAIL = true;
const SKIP_PRELOAD_EMOJI = true;
const CACHE_SHOW_CONTEXT_MENU_FOR_REOPEN = true; 
const ADVANCED_NOT_ALLOW_SCROLL_FOR_SHOW_CONTEXT_MENU = false;   // pause auto scroll faster when the context menu is about to show
  const ENABLE_MUTEX_FOR_SHOW_CONTEXT_MENU = true;                // avoid multiple requests on the same time
 
  const BOOST_MENU_OPENCHANGED_RENDERING = true;
  
const TAP_ACTION_DURATION = 280;


const INTERACTIVITY_BACKGROUND_ANIMATION = 1;         // mostly for pinned message
// 0 = default Yt animation background [= no fix];
  // 1 = disable default animation background [= keep special animation];
  // 2 = disable all animation backgrounds [= no animation backbround]
  
const USE_ADVANCED_TICKING = true; // added in Dec 2024 v0.66.0; need to ensure it would not affect the function if ticker design changed. to be reviewed
  // << if USE_ADVANCED_TICKING >>
  const FIX_TIMESTAMP_FOR_REPLAY = true;
  const ATTEMPT_TICKER_ANIMATION_START_TIME_DETECTION = true; // MUST BE true
  const REUSE_TICKER = true;  // for better memory control; currently it is only available in ADVANCED_TICKING; to be further reviewed
  // << end >>
 
  const DISABLE_Translation_By_Google = true;
 
  const FASTER_ICON_RENDERING = true;
  
const DELAY_FOCUSEDCHANGED = true;

const fixChildrenIssue801 = true; // if __children801__ is set [fix polymer controller method extration for `.set()`]

const FIX_ANIMATION_TICKER_TEXT_POSITION = true; // CSS fix; experimental; added in 2024.04.07
  const FIX_AUTHOR_CHIP_BADGE_POSITION = true;
  
const REACTION_ANIMATION_PANEL_CSS_FIX = true;
 
  const FIX_UNKNOWN_BUG_FOR_OVERLAY = true;
  
const FIX_MOUSEOVER_FN = true;  // avoid onMouseOver_ being triggerd quite a lot


const FIX_MEMORY_LEAKAGE_TICKER_ACTIONMAP = true;       // To fix Memory Leakage in yt-live-chat-ticker-...-item-renderer
  const FIX_MEMORY_LEAKAGE_TICKER_STATSBAR = true;        // To fix Memory Leakage in updateStatsBarAndMaybeShowAnimation
  const FIX_MEMORY_LEAKAGE_TICKER_TIMER = true;           // To fix Memory Leakage in setContainerWidth, slideDown, collapse // Dec 2024 fix in advance tickering
  const FIX_MEMORY_LEAKAGE_TICKER_DATACHANGED_setContainerWidth = true; // To fix Memory Leakage due to _.ytLiveChatTickerItemBehavior.setContainerWidth()
  
  
const MODIFY_EMIT_MESSAGES_FOR_BOOST_CHAT = true; // enabled for boost chat only; instant emit & no background flush

// unsure
kevlar_tuner_should_reuse_components = true;
EXPERIMENT_FLAGS.kevlar_tuner_should_reuse_components = true;
EXPERIMENT_FLAGS.kevlar_tuner_should_test_reuse_components = true;

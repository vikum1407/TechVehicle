// Spec: 02-data-model.md §8.1. Copied verbatim from the handoff package — do not change
// a value here without checking what else assumes it (rate limit scope names in 03-api.md,
// screen text like "Show N Results" in 04-screens.md).
export const MART_LIMITS = {
  TITLE_MAX: 100,
  DESCRIPTION_MAX: 3000,        // = LONG_TEXT_LEN
  MESSAGE_MAX: 1000,
  OFFER_NOTE_MAX: 300,
  REPORT_NOTE_MAX: 300,
  RATING_COMMENT_MAX: 500,
  SHOP_NAME_MAX: 60,
  SHOP_ABOUT_MAX: 300,
  SHOP_ADDRESS_MAX: 100,
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 40,
  PHOTOS_SELLING_MAX: 8,
  PHOTOS_WANTED_MAX: 8,
  OFFER_PHOTOS_MAX: 3,
  PRICE_MAX: 100_000_000,        // = MAX_AMOUNT
  YEAR_MIN: 1950,
  PAGE_SIZE: 20,                 // default take for every list
  PAGE_SIZE_MAX: 50,
  CLOSED_VISIBLE_DAYS: 7,
  SHOP_MIN_ADS: 5,
  SHOP_WINDOW_DAYS: 90,
  WANTED_ALERT_MAX_SELLERS: 20,
  WANTED_ALERT_LOOKBACK_MONTHS: 12,
  SEARCH_HISTORY_MAX: 30,
  SIMILAR_MAX: 10,
  MORE_FROM_SELLER_MAX: 10,
  DUPLICATE_REPORT_HOURS: 24,
}

export const MART_RATE_LIMITS = {            // checkRateLimit(scope, key=phone, max, windowMs)
  POST_LISTING:   { max: 10,  windowMs: 60 * 60 * 1000 },
  EDIT_LISTING:   { max: 60,  windowMs: 60 * 60 * 1000 },
  SEND_MESSAGE:   { max: 60,  windowMs: 60 * 60 * 1000 },
  SEND_OFFER:     { max: 30,  windowMs: 60 * 60 * 1000 },
  FAVORITE:       { max: 300, windowMs: 60 * 60 * 1000 },   // scope mart-fav
  MISC_WRITE:     { max: 60,  windowMs: 60 * 60 * 1000 },   // scope mart-misc: PATCH /mart/me, mark-sold, relist, status, POST /mart/threads (open), PUT shop-profile
  UPLOAD_PHOTO:   { max: 120, windowMs: 60 * 60 * 1000 },   // separate scope "mart-upload"
  REPORT:         { max: 10,  windowMs: 24 * 60 * 60 * 1000 },
  FOLLOW_BLOCK:   { max: 100, windowMs: 60 * 60 * 1000 },
  RATE_SELLER:    { max: 20,  windowMs: 60 * 60 * 1000 },
  SEARCH:         { max: 300, windowMs: 60 * 60 * 1000 },
}

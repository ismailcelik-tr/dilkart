import { router, type Href } from "expo-router";

/** Back when there is history (opened from a deep link there may be none). */
export function goBack(fallback: Href) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}

export type A11yFlags = {
  a11yLargeText?: boolean;
  a11yHighContrast?: boolean;
  a11yReduceMotion?: boolean;
};

export const A11Y_COOKIE = "a11y";

export function a11yCookieValue(flags: A11yFlags): string {
  const parts: string[] = [];
  if (flags.a11yLargeText) parts.push("lg");
  if (flags.a11yHighContrast) parts.push("hc");
  if (flags.a11yReduceMotion) parts.push("rm");
  return parts.join(",");
}

export function applyA11yClasses(el: HTMLElement, flags: A11yFlags) {
  el.classList.toggle("a11y-lg", !!flags.a11yLargeText);
  el.classList.toggle("contrast", !!flags.a11yHighContrast);
  el.classList.toggle("reduce-motion", !!flags.a11yReduceMotion);
}

export const A11Y_BOOTSTRAP = `(function(){try{var m=document.cookie.match(/(?:^|; )a11y=([^;]*)/);if(!m)return;var v=decodeURIComponent(m[1]);var h=document.documentElement;if(v.indexOf("lg")>=0)h.classList.add("a11y-lg");if(v.indexOf("hc")>=0)h.classList.add("contrast");if(v.indexOf("rm")>=0)h.classList.add("reduce-motion");}catch(e){}})();`;

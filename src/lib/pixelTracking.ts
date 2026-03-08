/**
 * Pixel Tracking Utility
 * Fires conversion events for Facebook, Google Ads, Google Analytics, TikTok, and Kwai pixels.
 * Each seller has their own pixels configured per product.
 */

export interface PixelConfig {
  id: string;
  platform: string;
  pixel_id: string;
  api_token: string | null;
  domain: string | null;
  events: string[];
  fire_on_pix_qr: boolean;
  fire_on_boleto: boolean;
  pix_conversion_value: number;
  boleto_conversion_value: number;
  disable_bump_events: boolean;
  is_active: boolean;
}

// Track which scripts have been loaded
const loadedScripts = new Set<string>();

// ============ SCRIPT LOADERS ============

function loadFacebookPixel(pixelId: string) {
  const key = `fb_${pixelId}`;
  if (loadedScripts.has(key)) return;
  loadedScripts.add(key);

  const w = window as any;
  if (!w.fbq) {
    const n: any = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    };
    w.fbq = n;
    if (!w._fbq) w._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  w.fbq('init', pixelId);
}

function loadGoogleAds(conversionId: string) {
  const key = `gads_${conversionId}`;
  if (loadedScripts.has(key)) return;
  loadedScripts.add(key);

  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function (...args: any[]) { w.dataLayer.push(args); };
  w.gtag('js', new Date());
  w.gtag('config', conversionId);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${conversionId}`;
  document.head.appendChild(script);
}

function loadGoogleAnalytics(measurementId: string) {
  const key = `ga_${measurementId}`;
  if (loadedScripts.has(key)) return;
  loadedScripts.add(key);

  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function (...args: any[]) { w.dataLayer.push(args); };
  w.gtag('js', new Date());
  w.gtag('config', measurementId);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

function loadTikTokPixel(pixelId: string) {
  const key = `tt_${pixelId}`;
  if (loadedScripts.has(key)) return;
  loadedScripts.add(key);

  const w = window as any;
  if (!w.ttq) {
    const ttq: any = (w.ttq = w.ttq || []);
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
    ttq.setAndDefer = function (t: any, e: string) {
      t[e] = function (...args: any[]) { t.push([e].concat(args)); };
    };
    for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
    ttq.instance = function (t: string) {
      const e = ttq._i[t] || [];
      for (const method of ttq.methods) ttq.setAndDefer(e, method);
      return e;
    };
    ttq.load = function (e: string) {
      const n = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = {};
      const s = document.createElement('script');
      s.type = 'text/javascript';
      s.async = true;
      s.src = n + '?sdkid=' + e + '&lib=ttq';
      document.head.appendChild(s);
    };
  }
  w.ttq.load(pixelId);
}

function loadKwaiPixel(pixelId: string) {
  const key = `kwai_${pixelId}`;
  if (loadedScripts.has(key)) return;
  loadedScripts.add(key);

  const w = window as any;
  if (!w.kwaiq) {
    const kwaiq: any = (w.kwaiq = w.kwaiq || { callMethod: undefined, queue: [] });
    kwaiq.load = function (id: string) {
      kwaiq._pixelId = id;
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://s1.kwai.net/kos/s101/nlav11HAg/pixel/events.js?sdkid=${id}`;
      document.head.appendChild(s);
    };
    kwaiq.page = function () { kwaiq.queue.push(['page']); };
    kwaiq.track = function (...args: any[]) { kwaiq.queue.push(['track', ...args]); };
  }
  w.kwaiq.load(pixelId);
}

// ============ EVENT MAPPERS ============

const FB_EVENT_MAP: Record<string, string> = {
  PageView: 'PageView',
  ViewContent: 'ViewContent',
  InitiateCheckout: 'InitiateCheckout',
  AddToCart: 'AddToCart',
  AddPaymentInfo: 'AddPaymentInfo',
  Purchase: 'Purchase',
  Lead: 'Lead',
  CompleteRegistration: 'CompleteRegistration',
  GenerateLead: 'Lead',
  BoletoGenerated: 'Purchase',
  PixGenerated: 'Purchase',
};

const GA_EVENT_MAP: Record<string, string> = {
  PageView: 'page_view',
  ViewContent: 'view_item',
  InitiateCheckout: 'begin_checkout',
  AddToCart: 'add_to_cart',
  AddPaymentInfo: 'add_payment_info',
  Purchase: 'purchase',
  Lead: 'generate_lead',
  CompleteRegistration: 'sign_up',
  GenerateLead: 'generate_lead',
  BoletoGenerated: 'purchase',
  PixGenerated: 'purchase',
};

const TIKTOK_EVENT_MAP: Record<string, string> = {
  PageView: 'ViewContent',
  ViewContent: 'ViewContent',
  InitiateCheckout: 'InitiateCheckout',
  AddToCart: 'AddToCart',
  AddPaymentInfo: 'AddPaymentInfo',
  Purchase: 'CompletePayment',
  Lead: 'SubmitForm',
  CompleteRegistration: 'CompleteRegistration',
  GenerateLead: 'SubmitForm',
  BoletoGenerated: 'CompletePayment',
  PixGenerated: 'CompletePayment',
};

// ============ FIRE EVENTS ============

function fireFacebookEvent(pixelId: string, eventName: string, params?: Record<string, any>) {
  const w = window as any;
  if (!w.fbq) return;
  const fbEvent = FB_EVENT_MAP[eventName] || eventName;
  w.fbq('trackSingle', pixelId, fbEvent, params || {});
}

function fireGoogleAdsEvent(conversionId: string, eventName: string, params?: Record<string, any>) {
  const w = window as any;
  if (!w.gtag) return;
  const gaEvent = GA_EVENT_MAP[eventName] || eventName;
  if (eventName === 'Purchase' || eventName === 'BoletoGenerated' || eventName === 'PixGenerated') {
    w.gtag('event', 'conversion', {
      send_to: conversionId,
      value: params?.value || 0,
      currency: params?.currency || 'BRL',
    });
  } else {
    w.gtag('event', gaEvent, { send_to: conversionId, ...params });
  }
}

function fireGoogleAnalyticsEvent(measurementId: string, eventName: string, params?: Record<string, any>) {
  const w = window as any;
  if (!w.gtag) return;
  const gaEvent = GA_EVENT_MAP[eventName] || eventName;
  w.gtag('event', gaEvent, { send_to: measurementId, ...params });
}

function fireTikTokEvent(pixelId: string, eventName: string, params?: Record<string, any>) {
  const w = window as any;
  if (!w.ttq) return;
  const ttEvent = TIKTOK_EVENT_MAP[eventName] || eventName;
  if (eventName === 'PageView') {
    w.ttq.page();
  } else {
    w.ttq.track(ttEvent, params || {});
  }
}

function fireKwaiEvent(pixelId: string, eventName: string, params?: Record<string, any>) {
  const w = window as any;
  if (!w.kwaiq) return;
  if (eventName === 'PageView') {
    w.kwaiq.page();
  } else {
    const kwaiEvent = eventName === 'Purchase' || eventName === 'BoletoGenerated' || eventName === 'PixGenerated'
      ? 'purchase' : eventName.toLowerCase();
    w.kwaiq.track(kwaiEvent, params || {});
  }
}

// ============ EVENT ID (FB Dedup) ============

let _eventIdCounter = 0;
function generateEventId(eventName: string): string {
  _eventIdCounter++;
  return `${eventName}_${Date.now()}_${_eventIdCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

// Store eventId per checkout session for InitiateCheckout→Purchase dedup
const _sessionEventIds = new Map<string, string>();

export function getOrCreateEventId(eventName: string, sessionKey?: string): string {
  if (sessionKey) {
    const key = `${sessionKey}_${eventName}`;
    let eid = _sessionEventIds.get(key);
    if (!eid) {
      eid = generateEventId(eventName);
      _sessionEventIds.set(key, eid);
    }
    return eid;
  }
  return generateEventId(eventName);
}

// ============ PUBLIC API ============

export function initPixels(pixels: PixelConfig[]) {
  const active = pixels.filter(p => p.is_active);
  for (const px of active) {
    switch (px.platform) {
      case 'facebook': loadFacebookPixel(px.pixel_id); break;
      case 'google_ads': loadGoogleAds(px.pixel_id); break;
      case 'google_analytics': loadGoogleAnalytics(px.pixel_id); break;
      case 'tiktok': loadTikTokPixel(px.pixel_id); break;
      case 'kwai': loadKwaiPixel(px.pixel_id); break;
    }
  }
}

/**
 * Fire a tracking event across all configured pixels that have this event enabled
 */
export function firePixelEvent(
  pixels: PixelConfig[],
  eventName: string,
  params?: { value?: number; currency?: string; content_name?: string; content_id?: string }
) {
  const active = pixels.filter(p => p.is_active);

  for (const px of active) {
    // Check if this event is in the pixel's configured events
    const events = Array.isArray(px.events) ? px.events : [];
    if (!events.includes(eventName)) continue;

    // Adjust value for PIX/Boleto conversion
    let eventParams = { ...params, currency: params?.currency || 'BRL' };
    if (eventName === 'PixGenerated' && px.fire_on_pix_qr) {
      eventParams.value = ((params?.value || 0) * px.pix_conversion_value) / 100;
    } else if (eventName === 'BoletoGenerated' && px.fire_on_boleto) {
      eventParams.value = ((params?.value || 0) * px.boleto_conversion_value) / 100;
    } else if (eventName === 'PixGenerated' && !px.fire_on_pix_qr) {
      continue; // Skip if not configured to fire on PIX
    } else if (eventName === 'BoletoGenerated' && !px.fire_on_boleto) {
      continue; // Skip if not configured to fire on boleto
    }

    switch (px.platform) {
      case 'facebook': fireFacebookEvent(px.pixel_id, eventName, eventParams); break;
      case 'google_ads': fireGoogleAdsEvent(px.pixel_id, eventName, eventParams); break;
      case 'google_analytics': fireGoogleAnalyticsEvent(px.pixel_id, eventName, eventParams); break;
      case 'tiktok': fireTikTokEvent(px.pixel_id, eventName, eventParams); break;
      case 'kwai': fireKwaiEvent(px.pixel_id, eventName, eventParams); break;
    }
  }
}

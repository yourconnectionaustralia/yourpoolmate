// File: marketing/site-analytics.js
//
// One GA4 event for the marketing site: start_free_click, sent when a
// visitor taps any "Start free" link or button that heads to the app.
// cta_location says which part of the page it was (hero, pricing, a
// guide's footer card...) so you can see which spots earn sign-ups.
// Page views, scrolls and outbound clicks already come from the gtag
// config in each page's <head> (GA4 enhanced measurement).
//
// No personal data: only a fixed area name and the page path.

(() => {
  const APP = 'https://app.yourpoolmate.com.au';

  function areaFor(el) {
    if (el.dataset.cta) return el.dataset.cta;
    const box = el.closest('[data-cta-area], section, header, footer, .sticky-cta');
    if (!box) return 'page';
    return box.dataset.ctaArea || box.id || (box.className && String(box.className).split(' ')[0]) || box.tagName.toLowerCase();
  }

  document.addEventListener('click', (event) => {
    const el = event.target.closest(`a[href^="${APP}"], .js-start, [data-cta]`);
    if (!el || typeof window.gtag !== 'function') return;
    window.gtag('event', 'start_free_click', {
      cta_location: String(areaFor(el)).slice(0, 40),
      page_path: window.location.pathname,
      transport_type: 'beacon',
    });
  });
})();

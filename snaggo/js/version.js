// Single source of truth for Snaggo's version — shown in the app footer so
// you can tell at a glance whether a new deploy has actually reached your
// device yet (vs. being stuck behind GitHub Pages' edge cache or this app's
// own offline cache).
//
// Bump this string on every change that ships, and bump sw.js's matching
// CACHE_NAME to the same value in the same commit — that second part is
// what actually forces the service worker to fetch fresh files; see the
// comment at the top of sw.js.
const SNAGGO_VERSION = '2026-11-06.3';

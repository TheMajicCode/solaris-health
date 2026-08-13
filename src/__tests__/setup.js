// Vitest global setup for the Digital Sovereign Passport frontend.
// Adds jest-dom matchers and a couple of jsdom polyfills the app relies on.
import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount React trees between tests to avoid cross-test leakage.
afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia — stub it for components that query it.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

// jsdom lacks ResizeObserver (recharts uses it) — provide a no-op.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Quietens "not wrapped in act(...)" noise from async effects in smoke tests.
if (!window.scrollTo) {
  window.scrollTo = vi.fn();
}

// jsdom does not implement Element.scrollIntoView — used by the Explore
// marker↔list sync to bring a matching card into view.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

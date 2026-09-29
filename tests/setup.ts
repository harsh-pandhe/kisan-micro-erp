import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement these DOM APIs, which Radix UI's Select/Dialog
// primitives call during pointer interaction; polyfill as no-ops so tests
// that open those components don't crash. See https://github.com/radix-ui/primitives/issues/1822
if (typeof window !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

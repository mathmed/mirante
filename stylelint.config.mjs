// Stylesheets run on the TVs' browsers (browserslist in package.json: Chromium 68): a CSS feature
// they lack (`:has`, `aspect-ratio`, `gap` in flexbox, `inset`, `clamp()`...) is an error, never a
// warning.
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-no-unsupported-browser-features'],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  reportDescriptionlessDisables: true,
  rules: {
    'plugin/no-unsupported-browser-features': [true, { severity: 'error' }],
    // Missing from the plugin's data: aspect-ratio (Chromium 88) and the individual transform
    // properties (Chromium 104). Banned by name.
    'property-disallowed-list': ['aspect-ratio', 'translate', 'scale', 'rotate'],
    // Supported, but a blur makes the TVs' GPUs redraw the whole area on every frame: darken with a
    // gradient instead.
    'function-disallowed-list': ['blur'],
  },
}

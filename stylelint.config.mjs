// Stylesheets run on the TVs' browsers (browserslist in package.json: Chromium 68): a CSS feature
// they lack (`:has`, `aspect-ratio`, `gap` in flexbox...) is an error, never a warning.
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-no-unsupported-browser-features'],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  reportDescriptionlessDisables: true,
  rules: {
    'plugin/no-unsupported-browser-features': [true, { severity: 'error' }],
    // Missing from the plugin's data (Chromium 88+): banned by name.
    'property-disallowed-list': ['aspect-ratio'],
  },
}

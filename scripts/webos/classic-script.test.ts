import { describe, expect, it } from 'vitest'

import { classicScript, classicScriptHtml } from './classic-script.ts'

// The index.html Vite writes for the build.
const VITE_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <title>Mirante</title>
    <script type="module" crossorigin src="./assets/index-BUtpiu81.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/style-q0_x80Ee.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`

describe('classicScriptHtml', () => {
  it('should load the bundle as a deferred classic script, without crossorigin', () => {
    expect(classicScriptHtml(VITE_HTML)).toBe(`<!doctype html>
<html lang="pt-BR">
  <head>
    <title>Mirante</title>
    <script defer src="./assets/index-BUtpiu81.js"></script>
    <link rel="stylesheet" href="./assets/style-q0_x80Ee.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`)
  })

  it.each([
    '<script crossorigin type="module" src="./a.js"></script>',
    '<link rel="modulepreload" href="./b.js">',
    '<script type="module">import "./a.js"</script>',
  ])('should refuse a page that still loads modules: %s', (tag) => {
    expect(() => classicScriptHtml(VITE_HTML.replace('<title>', `${tag}<title>`))).toThrow(
      'index.html still loads modules',
    )
  })

  it('should refuse a page without the script of the bundle', () => {
    expect(() => classicScriptHtml('<html><body></body></html>')).toThrow(
      'index.html loads no script',
    )
  })
})

describe('classicScript', () => {
  it('should rewrite index.html of the build, after Vite adds the tags of the bundle', () => {
    expect(classicScript()).toStrictEqual({
      name: 'mirante:classic-script',
      apply: 'build',
      transformIndexHtml: { order: 'post', handler: classicScriptHtml },
    })
  })
})

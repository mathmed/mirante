// Architecture contracts (make lint-arch). When one breaks, fix the import, not the contract:
// relaxing, removing or adding exceptions to a rule needs the owner's explicit approval.
//
//   src/core      pure logic: the startup flow, the runtime configuration, the photo library
//                 interface and its domain types; no DOM, no Node.js, no library
//   src/immich    the photo library implemented with @immich/sdk (read only)
//   src/platform  what differs between the TVs and the browser: runtime config file, console
//   src/ui        Preact components and the user-facing messages
//   src/main.tsx  composition root: wires the adapters into the UI

const UI_LIBRARIES = 'node_modules/(@types/)?(preact|react|react-dom)/'
const IMMICH_SDK = 'node_modules/@immich/sdk/'
const TEST_FILE = '\\.test\\.tsx?$'

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'core-is-the-innermost-layer',
      comment:
        'The core declares the interfaces the adapters implement; immich, platform and ui depend ' +
        'on it, never the other way around.',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: ['^src/(immich|platform|ui)/', '^src/main\\.tsx$'] },
    },
    {
      name: 'core-is-pure',
      comment:
        'The core is pure logic: no Node.js built-in and no npm package (not even the UI library ' +
        'or the Immich SDK). Platform services reach it through interfaces it declares.',
      severity: 'error',
      from: { path: '^src/core/', pathNot: TEST_FILE },
      to: { dependencyTypes: ['core', 'npm', 'npm-dev', 'npm-peer', 'npm-optional'] },
    },
    {
      name: 'only-the-immich-adapter-imports-the-sdk',
      comment:
        'The rest of the app reads photos through the core photo library interface and its ' +
        'domain types, never through the SDK or its DTOs.',
      severity: 'error',
      from: { path: '^src/', pathNot: ['^src/immich/'] },
      to: { path: IMMICH_SDK },
    },
    {
      name: 'immich-only-knows-the-core',
      comment: 'The Immich adapter implements the core interface: no UI, no platform code.',
      severity: 'error',
      from: { path: '^src/immich/' },
      to: { path: ['^src/(platform|ui)/', '^src/main\\.tsx$', UI_LIBRARIES] },
    },
    {
      name: 'platform-only-knows-the-core',
      comment:
        'Platform code (the runtime config file, the console) serves the core: no UI, no Immich.',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: ['^src/(immich|ui)/', '^src/main\\.tsx$', UI_LIBRARIES] },
    },
    {
      name: 'ui-receives-its-adapters',
      comment:
        'Components get the photo library and the platform services injected by the composition ' +
        'root (src/main.tsx); they never import the adapters.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: ['^src/(immich|platform)/', '^src/main\\.tsx$'] },
    },
    {
      name: 'app-runs-in-the-browser',
      comment: 'The app runs in the browsers of the TVs: Node.js built-ins do not exist there.',
      severity: 'error',
      from: { path: '^src/', pathNot: TEST_FILE },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-circular',
      comment: 'Circular dependencies make the layers meaningless; extract what both sides need.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'product-does-not-import-tooling',
      comment: 'The app never ships CI scripts or test support code.',
      severity: 'error',
      from: { path: '^src/', pathNot: TEST_FILE },
      to: { path: ['^(scripts|test|e2e)/', TEST_FILE] },
    },
    {
      name: 'tooling-does-not-import-the-product',
      comment: 'The CI scripts are independent from the app they check.',
      severity: 'error',
      from: { path: '^scripts/' },
      to: { path: '^src/' },
    },
    {
      name: 'scripts-do-not-import-tests',
      severity: 'error',
      from: { path: '^scripts/', pathNot: TEST_FILE },
      to: { path: TEST_FILE },
    },
    {
      name: 'no-dev-dependencies-in-the-product',
      comment: 'Libraries the app runs with are dependencies, not devDependencies.',
      severity: 'error',
      from: { path: '^src/', pathNot: TEST_FILE },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'no-undeclared-packages',
      comment: 'Every imported package is declared in package.json.',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'no-unresolvable-imports',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.test.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'types', 'default'],
    },
    skipAnalysisNotInRules: true,
  },
}

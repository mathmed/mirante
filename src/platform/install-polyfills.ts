// The first import of src/main.tsx: its body runs before any other module of the bundle, Preact
// and the Immich SDK included, so nothing ever sees the engine without the polyfills.
import { installPolyfills } from './polyfills.ts'

installPolyfills()

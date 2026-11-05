// A problem with what the packaging was given (the build, appinfo.json, the configuration), told to
// the person packaging in Portuguese: they fix it and run the command again.
export class PackagingError extends Error {
  override readonly name = 'PackagingError'
}

import { describe, expect, it, vi } from 'vitest'

import { aresPackageCommand, runCommand, WEBOS_CLI } from './ares.ts'

describe('aresPackageCommand', () => {
  it('should run the pinned webOS CLI through npx, without minifying the build again', () => {
    expect(aresPackageCommand('/out/app', '/out')).toStrictEqual([
      'npx',
      '--yes',
      '--package=@webos-tools/cli@3.2.6',
      'ares-package',
      '--no-minify',
      '--outdir',
      '/out',
      '/out/app',
    ])
    expect(WEBOS_CLI).toBe('@webos-tools/cli@3.2.6')
  })
})

describe('runCommand', () => {
  it('should settle with the exit code of the command', async () => {
    expect(await runCommand([process.execPath, '-e', 'process.exit(3)'])).toBe(3)
    expect(await runCommand([process.execPath, '-e', ''])).toBe(0)
  })

  it('should fail a command that a signal stopped', async () => {
    expect(await runCommand([process.execPath, '-e', 'process.kill(process.pid, "SIGKILL")'])).toBe(
      1,
    )
  })

  it('should explain a program that cannot run', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(await runCommand(['mirante-no-such-program'])).toBe(127)
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Não foi possível rodar mirante-no-such-program: spawn mirante-no-such-program ENOENT',
      ),
    )
  })
})

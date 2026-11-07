// The screenshots of the management of the library (make screenshots), with the key of the changes
// on the proxy: three photos of the trip marked, the bar of their actions in focus; the confirmation
// of their deletion; and the choice of the album they go to, at 1920x1080 and at 1280x720, where it
// shows fewer albums at once. Nothing is changed.
import type { Page } from 'playwright'

import type { FakeImmich } from './fake-immich-server.ts'
import { WRITE_PERMISSIONS } from './packaged-app.ts'
import { focusedOn, press, settled, shoot } from './screenshot-page.ts'

const BACK = 'Escape'
const SMALL_VIEWPORT = { width: 1280, height: 720 }

type Open = (viewport?: { readonly width: number; readonly height: number }) => Promise<Page>

// The proxy holds the key of the changes while the screens are captured, then none again.
export async function shootManagement(immich: FakeImmich, open: Open): Promise<void> {
  immich.grantWrites(WRITE_PERMISSIONS)
  try {
    await shootScreens(await open())
    await shootSmallPicker(await open(SMALL_VIEWPORT))
  } finally {
    immich.grantWrites(undefined)
  }
}

// The trip, three of its photos marked, the first action of the bar in focus.
async function markPhotos(page: Page): Promise<void> {
  await focusedOn(page, 'Todas')
  await press(page, 'ArrowRight', 'Enter')
  await focusedOn(page, 'Novo álbum')
  await press(page, 'ArrowRight', 'Enter')
  await page.getByRole('heading', { level: 1, name: 'Viagem a Lisboa' }).waitFor()
  await page.locator('.grid-photos').waitFor()
  await press(page, 'ArrowUp', 'Enter', 'Enter', 'ArrowRight', 'Enter', 'ArrowDown', 'Enter')
  await press(page, BACK)
  await focusedOn(page, 'Adicionar ao álbum')
}

async function shootSmallPicker(page: Page): Promise<void> {
  await markPhotos(page)
  await press(page, 'Enter')
  await page.getByText('Praia do Rosa').waitFor()
  await press(page, 'ArrowDown')
  await settled(page)
  await shoot(page, '31-gestao-adicionar-720')
  await page.close()
}

async function shootScreens(page: Page): Promise<void> {
  await markPhotos(page)
  await settled(page)
  await shoot(page, '28-gestao-selecao')

  await press(page, 'ArrowRight', 'ArrowRight', 'Enter')
  await page.getByRole('dialog', { name: 'Apagar 3 fotos?' }).waitFor()
  await settled(page)
  await shoot(page, '29-gestao-apagar')

  // Cancelled, the focus is on the grid, which still selects: Back reaches the bar again.
  await press(page, BACK, BACK, 'Enter')
  await page.getByText('Praia do Rosa').waitFor()
  await press(page, 'ArrowDown')
  await settled(page)
  await shoot(page, '30-gestao-adicionar')
  await page.close()
}

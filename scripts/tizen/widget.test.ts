import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readText } from '../shared/files.ts'
import { widgetOf, widgetVersionOf } from './widget.ts'

const ROOT = join(import.meta.dirname, '../..')
const WIDGET =
  '<widget xmlns="http://www.w3.org/ns/widgets" id="https://github.com/mathmed/mirante">'
const APPLICATION =
  '<tizen:application id="MirantTV01.Mirante" package="MirantTV01" required_version="6.5"/>'
const NAME = '<name>Mirante</name>'
const CONTENT = '<content src="index.html"/>'
const ICON = '<icon src="icon.png"/>'
const ACCESS = '<access origin="*" subdomains="true"/>'
const PRIVILEGE = '<tizen:privilege name="http://tizen.org/privilege/internet"/>'
const BODY = `${NAME}${CONTENT}${ICON}${ACCESS}${PRIVILEGE}`
const ACCESS_ERROR =
  'O tizen/config.xml precisa de <access origin="*" subdomains="true"/> e de <tizen:privilege name="http://tizen.org/privilege/internet"/>, para o app alcançar o proxy do Immich.'

interface TemplateParts {
  readonly widget?: string
  readonly application?: string
  readonly body?: string
}

function template({
  widget = WIDGET,
  application = APPLICATION,
  body = BODY,
}: TemplateParts = {}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${widget}\n  ${application}\n  ${body}\n</widget>\n`
}

function occurrences(text: string, part: string): number {
  return text.split(part).length - 1
}

describe('the config.xml of the repository', () => {
  it('should describe Mirante as a Samsung TV widget, at the version of package.json', async () => {
    const version = widgetVersionOf(await readText(join(ROOT, 'package.json')))

    const sut = widgetOf(await readText(join(ROOT, 'tizen/config.xml')), version)

    expect(sut).toMatchObject({
      id: 'MirantTV01.Mirante',
      name: 'Mirante',
      version,
      content: 'index.html',
      icon: 'icon.png',
    })
    expect(sut.text).toContain(
      `<widget version="${version}" xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="https://github.com/mathmed/mirante" viewmodes="maximized">`,
    )
    expect(sut.text).toContain(APPLICATION)
    expect(sut.text).toContain('<tizen:profile name="tv-samsung"/>')
    expect(sut.text).not.toContain('<!--')
  })

  it('should let the app reach any origin and ask the TV for the network alone', async () => {
    const sut = await readText(join(ROOT, 'tizen/config.xml'))

    expect(occurrences(sut, '<access ')).toBe(1)
    expect(sut).toContain(ACCESS)
    expect(occurrences(sut, '<tizen:privilege ')).toBe(1)
    expect(sut).toContain(PRIVILEGE)
    expect(sut).not.toContain('privilege/tv.inputdevice')
  })
})

describe('widgetOf', () => {
  it('should add the version to the widget element and drop the comments', () => {
    const sut = widgetOf(`<!-- <widget>, <name>Old</name> -->\n${template()}`, '1.2.3')

    expect(sut.text).toBe(
      `\n${template({ widget: WIDGET.replace('<widget ', '<widget version="1.2.3" ') })}`,
    )
    expect(sut.name).toBe('Mirante')
  })

  it('should read attributes across lines and blanks', () => {
    const application =
      '<tizen:application\n    id = "MirantTV01.Mirante"\tpackage="MirantTV01"\n    required_version="6.5" />'

    expect(widgetOf(template({ application }), '1.0.0').id).toBe('MirantTV01.Mirante')
  })

  it('should refuse a version written in the template', () => {
    expect(() => widgetOf(template({ widget: '<widget version="1.0.0">' }), '1.0.0')).toThrow(
      'Tire o version do <widget> do tizen/config.xml: a versão do app vem do package.json.',
    )
  })

  it.each([
    { name: 'widget', text: template({ widget: '<widgets>' }) },
    { name: 'tizen:application', text: template({ application: '' }) },
    { name: 'content', text: template({ body: `${NAME}${ICON}${ACCESS}${PRIVILEGE}` }) },
    { name: 'icon', text: template({ body: `${NAME}${CONTENT}${ACCESS}${PRIVILEGE}` }) },
  ])('should refuse a template without the element $name', ({ name, text }) => {
    expect(() => widgetOf(text, '1.0.0')).toThrow(`Falta o elemento <${name}> no tizen/config.xml.`)
  })

  it.each([
    { attribute: 'id', application: APPLICATION.replace('id="MirantTV01.Mirante"', '') },
    { attribute: 'package', application: APPLICATION.replace('package="MirantTV01"', '') },
    {
      attribute: 'required_version',
      application: APPLICATION.replace('required_version="6.5"', ''),
    },
    { attribute: 'id', application: APPLICATION.replace('id="MirantTV01.Mirante"', 'id=" "') },
  ])('should refuse an application without $attribute', ({ attribute, application }) => {
    expect(() => widgetOf(template({ application }), '1.0.0')).toThrow(
      `Falta o atributo ${attribute} de <tizen:application> no tizen/config.xml.`,
    )
  })

  it.each([
    { name: 'content', body: BODY.replace(CONTENT, '<content/>') },
    { name: 'icon', body: BODY.replace(ICON, '<icon src=""/>') },
  ])('should refuse a $name without its src', ({ name, body }) => {
    expect(() => widgetOf(template({ body }), '1.0.0')).toThrow(
      `Falta o atributo src de <${name}> no tizen/config.xml.`,
    )
  })

  it.each([
    ['Mirant01.Mirante', 'Mirant01'],
    ['MirantTV01.Mirante', 'MirantTV02'],
    ['MirantTV01', 'MirantTV01'],
    ['MirantTV01.Mira-nte', 'MirantTV01'],
    ['MirantTV01.Mira.nte', 'MirantTV01'],
    [`MirantTV01.${'M'.repeat(53)}`, 'MirantTV01'],
    ['MirantTV0!.Mirante', 'MirantTV0!'],
  ])('should refuse the id %s of the package %s', (id, packageId) => {
    const application = `<tizen:application id="${id}" package="${packageId}" required_version="6.5"/>`

    expect(() => widgetOf(template({ application }), '1.0.0')).toThrow(
      `O id "${id}" do tizen/config.xml não serve para o Tizen`,
    )
  })

  it('should take an application name of 52 letters and digits', () => {
    const id = `MirantTV01.${'M'.repeat(51)}2`
    const application = `<tizen:application id="${id}" package="MirantTV01" required_version="6.5"/>`

    expect(widgetOf(template({ application }), '1.0.0').id).toBe(id)
  })

  it.each([
    { name: 'no name', body: BODY.replace(NAME, '') },
    { name: 'an empty name', body: BODY.replace(NAME, '<name> </name>') },
    { name: 'a name with a space', body: BODY.replace(NAME, '<name>Mi rante</name>') },
    { name: 'a name with a slash', body: BODY.replace(NAME, '<name>../x</name>') },
  ])('should refuse $name, which names the .wgt', ({ body }) => {
    expect(() => widgetOf(template({ body }), '1.0.0')).toThrow(
      'O <name> do tizen/config.xml precisa de letras, números, ., - ou _, sem espaços',
    )
  })

  it.each([
    { name: 'no access', body: BODY.replace(ACCESS, '') },
    {
      name: 'an access to one origin only',
      body: BODY.replace(ACCESS, '<access origin="https://immich.test"/>'),
    },
    { name: 'no privilege', body: BODY.replace(PRIVILEGE, '') },
    {
      name: 'another privilege',
      body: BODY.replace('privilege/internet', 'privilege/tv.inputdevice'),
    },
    {
      name: 'a privilege that is not an address',
      body: BODY.replace(PRIVILEGE, '<tizen:privilege name="internet"/>'),
    },
    { name: 'a privilege without a name', body: BODY.replace(PRIVILEGE, '<tizen:privilege/>') },
  ])('should refuse a widget with $name, which cannot reach Immich', ({ body }) => {
    expect(() => widgetOf(template({ body }), '1.0.0')).toThrow(ACCESS_ERROR)
  })

  it('should take the internet privilege written with https too', () => {
    const body = BODY.replace('name="http:', 'name="https:')

    expect(widgetOf(template({ body }), '1.0.0').id).toBe('MirantTV01.Mirante')
  })

  it('should refuse a comment that does not end', () => {
    expect(() => widgetOf(`${template()}<!-- open`, '1.0.0')).toThrow(
      'Um comentário do tizen/config.xml não termina com -->.',
    )
  })
})

describe('widgetVersionOf', () => {
  it.each(['0.0.0', '1.2.3', '255.255.65535', '10.0.123'])(
    'should take the version %s',
    (version) => {
      expect(widgetVersionOf(JSON.stringify({ version }))).toBe(version)
    },
  )

  it.each([
    '1.2',
    '1.2.3-beta.1',
    '01.2.3',
    '1.2.3.4.5',
    '256.0.0',
    '0.256.0',
    '0.0.65536',
    '1.2.x',
    7,
  ])('should refuse a version the Tizen tools do not take: %s', (version) => {
    expect(() => widgetVersionOf(JSON.stringify({ version }))).toThrow(
      `A versão do package.json (${String(version)}) não serve para o Tizen`,
    )
  })
})

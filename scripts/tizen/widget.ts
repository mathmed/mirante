import { jsonObjectOf } from '../packaging/json-file.ts'
import { PackagingError } from '../packaging/packaging-error.ts'

// tizen/config.xml, the description of the widget the TV installs. It is plain enough to read
// without an XML library: tags with double-quoted attributes, comments, and the text of <name>.
const TEMPLATE_FILE = 'tizen/config.xml'
const COMMENT_START = '<!--'
const COMMENT_END = '-->'
const TAG_START = '<'
const TAG_END = '>'
const TAG_NAME_END = /[\s/]/
const QUOTE = '"'
const BLANKS = /\s+/g
const SPACE = ' '
const TRAILING_EQUALS = /=$/
// Split on the quotes, a tag alternates the text before a value and the value.
const PARTS_PER_ATTRIBUTE = 2
const NAME = /<name>([^<]*)<\/name>/
const WIDGET_START = /<widget\b/
// The rules of the Tizen tools: a package id of 10 letters and digits, an application id of the
// package id, a dot and a name of letters and digits, and a version of three numbers up to
// 255.255.65535.
const PACKAGE_ID = /^[\dA-Za-z]{10}$/
const APPLICATION_NAME = /^[\dA-Za-z]{1,52}$/
const VERSION = /^(?:0|[1-9]\d{0,4})\.(?:0|[1-9]\d{0,4})\.(?:0|[1-9]\d{0,4})$/
const MAX_MAJOR_OR_MINOR = 255
const MAX_MICRO = 65_535
// The position of the micro number, the third.
const MICRO = 2
// The name of the .wgt file, as the Tizen CLI names it too.
const FILE_NAME = /^[\w.-]+$/
// Tizen names its privileges with http URIs, which are identifiers, never fetched: they are
// compared by host and path. Mirante needs the network, to reach Immich across origins from file://.
const INTERNET = 'tizen.org/privilege/internet'
const ANY_ORIGIN = '*'

type Attributes = ReadonlyMap<string, string>
interface Tag {
  readonly name: string
  readonly attributes: Attributes
}

export interface Widget {
  // The application id the Tizen CLI launches: <package id>.<name>.
  readonly id: string
  readonly name: string
  readonly version: string
  // The page the TV opens and the icon of the launcher, by their paths in the widget.
  readonly content: string
  readonly icon: string
  // The whole config.xml, as the TV reads it: the template with the version, without comments.
  readonly text: string
}

// The version of the widget is the version of package.json, never one written in tizen/config.xml.
export function widgetVersionOf(packageJsonText: string): string {
  const version = jsonObjectOf(packageJsonText, 'package.json').get('version')
  if (typeof version !== 'string' || !isWidgetVersion(version)) {
    throw new PackagingError(
      `A versão do package.json (${String(version)}) não serve para o Tizen: use três números até 255.255.65535, como 1.2.3.`,
    )
  }
  return version
}

export function widgetOf(templateText: string, version: string): Widget {
  const tags = tagsOf(templateText)
  const widget = requiredTag(tags, 'widget')
  if (widget.attributes.has('version')) {
    throw new PackagingError(
      `Tire o version do <widget> do ${TEMPLATE_FILE}: a versão do app vem do package.json.`,
    )
  }
  checkAccess(tags)
  return {
    id: applicationId(requiredTag(tags, 'tizen:application').attributes),
    name: nameOf(templateText),
    version,
    content: requiredAttribute(requiredTag(tags, 'content'), 'src'),
    icon: requiredAttribute(requiredTag(tags, 'icon'), 'src'),
    // Without the comments of the template, so that the version lands in the element.
    text: withoutComments(templateText).replace(WIDGET_START, `<widget version="${version}"`),
  }
}

function isWidgetVersion(version: string): boolean {
  return (
    VERSION.test(version) &&
    version
      .split('.')
      .every((part, index) => Number(part) <= (index === MICRO ? MAX_MICRO : MAX_MAJOR_OR_MINOR))
  )
}

function tagsOf(text: string): readonly Tag[] {
  return withoutComments(text).split(TAG_START).slice(1).map(tagOf)
}

// A closing tag has no name: it starts with a slash.
function tagOf(chunk: string): Tag {
  const inside = chunk.slice(0, chunk.indexOf(TAG_END))
  const [name = ''] = inside.split(TAG_NAME_END, 1)
  return { name, attributes: attributesOf(inside) }
}

function attributesOf(inside: string): Attributes {
  const attributes = new Map<string, string>()
  let key = ''
  inside.split(QUOTE).forEach((part, index) => {
    if (index % PARTS_PER_ATTRIBUTE === 0) {
      key = keyAtTheEndOf(part)
    } else {
      attributes.set(key, part)
    }
  })
  return attributes
}

// The text before a value ends with the key and an equals sign, maybe with blanks around it.
function keyAtTheEndOf(text: string): string {
  const words = text.replace(BLANKS, SPACE).trim().replace(TRAILING_EQUALS, '').trimEnd()
  return words.slice(words.lastIndexOf(SPACE) + 1)
}

function withoutComments(text: string): string {
  const [head = '', ...rest] = text.split(COMMENT_START)
  const tails = rest.map((part) => {
    const end = part.indexOf(COMMENT_END)
    if (end === -1) {
      throw new PackagingError(`Um comentário do ${TEMPLATE_FILE} não termina com ${COMMENT_END}.`)
    }
    return part.slice(end + COMMENT_END.length)
  })
  return [head, ...tails].join('')
}

function requiredTag(tags: readonly Tag[], name: string): Tag {
  const tag = tags.find((candidate) => candidate.name === name)
  if (tag === undefined) {
    throw new PackagingError(`Falta o elemento <${name}> no ${TEMPLATE_FILE}.`)
  }
  return tag
}

function requiredAttribute(tag: Tag, name: string): string {
  const value = tag.attributes.get(name)?.trim() ?? ''
  if (value === '') {
    throw new PackagingError(`Falta o atributo ${name} de <${tag.name}> no ${TEMPLATE_FILE}.`)
  }
  return value
}

function applicationId(attributes: Attributes): string {
  const tag = { name: 'tizen:application', attributes }
  const packageId = requiredAttribute(tag, 'package')
  const id = requiredAttribute(tag, 'id')
  requiredAttribute(tag, 'required_version')
  const [prefix, ...names] = id.split('.')
  const isValid =
    PACKAGE_ID.test(packageId) && prefix === packageId && APPLICATION_NAME.test(names.join('.'))
  if (!isValid) {
    throw new PackagingError(
      `O id "${id}" do ${TEMPLATE_FILE} não serve para o Tizen: use o pacote de 10 letras e números (package="${packageId}"), um ponto e o nome, como MirantTV01.Mirante.`,
    )
  }
  return id
}

function nameOf(text: string): string {
  const name = NAME.exec(withoutComments(text))?.[1]?.trim() ?? ''
  if (!FILE_NAME.test(name)) {
    throw new PackagingError(
      `O <name> do ${TEMPLATE_FILE} precisa de letras, números, ., - ou _, sem espaços: ele dá nome ao .wgt.`,
    )
  }
  return name
}

// The app loads from file:// and calls the proxy of Immich: the TV only lets a widget reach the
// origins its config.xml allows, and only with the internet privilege.
function checkAccess(tags: readonly Tag[]): void {
  const hasAccess = tags.some(
    (tag) => tag.name === 'access' && tag.attributes.get('origin') === ANY_ORIGIN,
  )
  const hasInternet = tags.some(
    (tag) => tag.name === 'tizen:privilege' && privilegeOf(tag) === INTERNET,
  )
  if (!hasAccess || !hasInternet) {
    throw new PackagingError(
      `O ${TEMPLATE_FILE} precisa de <access origin="${ANY_ORIGIN}" subdomains="true"/> e de <tizen:privilege name="http://${INTERNET}"/>, para o app alcançar o proxy do Immich.`,
    )
  }
}

function privilegeOf(tag: Tag): string | undefined {
  const url = URL.parse(tag.attributes.get('name') ?? '')
  return url === null ? undefined : `${url.host}${url.pathname}`
}

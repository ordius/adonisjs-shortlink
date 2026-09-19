/**
 * @ordius/adonisjs-shortlink
 */

import { configProvider } from '@adonisjs/core'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { ConfigProvider } from '@adonisjs/core/types'

import type {
  ResolvedAttributeMap,
  ResolvedShortlinkConfig,
  ShortlinkConfig,
  ShortlinkModel,
} from './types.js'

const DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const DEFAULT_SLUG_PATTERN = /^[A-Za-z0-9_-]{1,255}$/

/**
 * Table columns the package depends on. Their attribute names are
 * resolved from the model (see `resolveAttributes`) instead of being
 * hardcoded, so the app's own naming strategy (camelCase, snake_case, ...)
 * is never fought.
 */
const REQUIRED_COLUMNS = ['domain', 'slug', 'original_url', 'clicks'] as const
const OPTIONAL_COLUMNS = ['metadata'] as const

/**
 * Normalizes a bare hostname or a full URL down to its hostname, so
 * lookups behave the same regardless of how the app configured it. Ports
 * are dropped, matching how Adonis compares `.domain()` routes.
 */
function normalizeDomain(input: string): string {
  const trimmed = input.trim()

  if (!trimmed) {
    throw new RuntimeException('Invalid "config/shortlink.ts" file. "domain" cannot be empty')
  }

  let hostname: string

  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`)
    hostname = url.hostname
  } catch {
    throw new RuntimeException(
      `Invalid "config/shortlink.ts" file. "domain" value "${input}" is not a valid hostname`
    )
  }

  // A URL like `file:///tmp` parses without throwing but leaves an empty
  // hostname — reject it the same way a genuinely unparsable value is.
  if (!hostname) {
    throw new RuntimeException(
      `Invalid "config/shortlink.ts" file. "domain" value "${input}" is not a valid hostname`
    )
  }

  return hostname
}

/**
 * Resolves each table column the package depends on to the model's
 * attribute name for it, so the service can read/write through the app's
 * own naming strategy instead of a hardcoded camelCase contract.
 */
function resolveAttributes(model: ShortlinkModel): ResolvedAttributeMap {
  model.boot()
  const columnsToAttributes = model.$keys.columnsToAttributes

  const required: Record<string, string> = {}
  for (const column of REQUIRED_COLUMNS) {
    const attribute = columnsToAttributes.get(column)
    if (!attribute) {
      throw new RuntimeException(
        `Invalid "config/shortlink.ts" file. Model "${model.name}" has no column mapped to "${column}", which "@ordius/adonisjs-shortlink" requires`
      )
    }
    required[column] = attribute
  }

  const optional: Record<string, string> = {}
  for (const column of OPTIONAL_COLUMNS) {
    const attribute = columnsToAttributes.get(column)
    if (attribute) optional[column] = attribute
  }

  return {
    domain: required.domain,
    slug: required.slug,
    originalUrl: required.original_url,
    clicks: required.clicks,
    // Only set the key when the model actually maps the column — an
    // `undefined` value would still make it own-enumerable, unlike a
    // genuinely absent key (observable via `Object.keys`/`deepEqual`).
    ...(optional.metadata ? { metadata: optional.metadata } : {}),
  }
}

/**
 * Normalizes a path prefix to either `''` or `/x` — never a trailing
 * slash, so it can be concatenated directly in front of `/:slug`.
 */
function normalizePrefix(prefix?: string): string {
  if (!prefix) return ''
  const withLeadingSlash = prefix.startsWith('/') ? prefix : `/${prefix}`
  return withLeadingSlash.replace(/\/+$/, '')
}

/**
 * Defines the shortlink configuration.
 *
 * Validation and defaulting are deferred to resolve time (via
 * `configProvider.create`), so the config can rely on the app already
 * being initialized instead of running at import time.
 */
export function defineConfig<Model extends ShortlinkModel>(
  config: ShortlinkConfig<Model>
): ConfigProvider<ResolvedShortlinkConfig<Model>> {
  return configProvider.create(async () => {
    if (!config.model) {
      throw new RuntimeException(
        'Invalid "config/shortlink.ts" file. Missing "model". Define it using the "model" property'
      )
    }

    if (!config.domain) {
      throw new RuntimeException(
        'Invalid "config/shortlink.ts" file. Missing "domain". Define it using the "domain" property'
      )
    }

    const importedModel = await config.model()
    const model = importedModel.default

    const primaryDomain = normalizeDomain(config.domain)
    const extraDomains = (config.domains ?? []).map(normalizeDomain)
    const domains = [...new Set([primaryDomain, ...extraDomains])]

    const slugConfig = config.slug ?? {}
    const length = slugConfig.length ?? 8
    if (length < 4) {
      throw new RuntimeException(
        'Invalid "config/shortlink.ts" file. "slug.length" must be at least 4'
      )
    }

    const alphabet = slugConfig.alphabet ?? DEFAULT_ALPHABET
    if (new Set(alphabet).size < 2) {
      throw new RuntimeException(
        'Invalid "config/shortlink.ts" file. "slug.alphabet" must have at least 2 unique characters'
      )
    }

    const pattern = slugConfig.pattern ?? DEFAULT_SLUG_PATTERN
    if (pattern.global || pattern.sticky) {
      throw new RuntimeException(
        'Invalid "config/shortlink.ts" file. "slug.pattern" must not use the "g" or "y" flag — ' +
          'it is reused across ".test()" calls and those flags carry "lastIndex" between them'
      )
    }

    return {
      model,
      attributes: resolveAttributes(model),
      domain: primaryDomain,
      domains,
      protocol: config.protocol ?? 'https',
      prefix: normalizePrefix(config.prefix),
      redirectStatusCode: config.redirectStatusCode ?? 302,
      trackClicks: config.trackClicks ?? true,
      slug: {
        length,
        alphabet,
        pattern,
        reserved: new Set((slugConfig.reserved ?? []).map((value) => value.toLowerCase())),
        maxAttempts: slugConfig.maxAttempts ?? 5,
      },
      allowedProtocols: config.allowedProtocols ?? ['http:', 'https:'],
    }
  })
}

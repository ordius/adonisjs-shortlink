/**
 * @ordius/adonisjs-shortlink
 */

import { configProvider } from '@adonisjs/core'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { ConfigProvider } from '@adonisjs/core/types'

import type { ResolvedShortlinkConfig, ShortlinkConfig, ShortlinkModel } from './types.js'

const DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const DEFAULT_SLUG_PATTERN = /^[A-Za-z0-9_-]{1,255}$/

/**
 * Normalizes a bare hostname or a full URL down to its hostname, so
 * lookups behave the same regardless of how the app configured it.
 */
function normalizeDomain(input: string): string {
  const trimmed = input.trim()

  if (!trimmed) {
    throw new RuntimeException('Invalid "config/shortlink.ts" file. "domain" cannot be empty')
  }

  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`)
    return url.host
  } catch {
    throw new RuntimeException(
      `Invalid "config/shortlink.ts" file. "domain" value "${input}" is not a valid hostname`
    )
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

    return {
      model,
      domain: primaryDomain,
      domains,
      protocol: config.protocol ?? 'https',
      prefix: normalizePrefix(config.prefix),
      redirectStatusCode: config.redirectStatusCode ?? 302,
      trackClicks: config.trackClicks ?? true,
      slug: {
        length,
        alphabet,
        pattern: slugConfig.pattern ?? DEFAULT_SLUG_PATTERN,
        reserved: new Set((slugConfig.reserved ?? []).map((value) => value.toLowerCase())),
        maxAttempts: slugConfig.maxAttempts ?? 5,
      },
      allowedProtocols: config.allowedProtocols ?? ['http:', 'https:'],
    }
  })
}

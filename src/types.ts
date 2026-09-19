/**
 * @ordius/adonisjs-shortlink
 *
 * Type definitions for the Shortlink package
 */

import type { ConfigProvider } from '@adonisjs/core/types'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { LucidModel, LucidRow, ModelAttributes } from '@adonisjs/lucid/types/model'

/**
 * Minimum shape a shortlink row must have. The package depends on TABLE
 * COLUMNS (`domain`, `slug`, `original_url`, `clicks`, optionally
 * `metadata`), not on any particular attribute naming — so a model using
 * `SnakeCaseNamingStrategy` (`declare original_url: string`) type-checks
 * here just as well as the default camelCase one. Apps are free to add
 * extra columns (group, createdBy, referer, ...) on top of this contract;
 * they stay reachable through `attributes` on create/update.
 */
export interface ShortlinkRow extends LucidRow {
  id: number | string
}

export type ShortlinkModel = LucidModel & { new (): ShortlinkRow }

/**
 * Apps augment this interface inside their `config/shortlink.ts` file so
 * the `shortlink` service singleton (and its container binding) is typed
 * with their own model.
 *
 * @example
 * declare module '@ordius/adonisjs-shortlink/types' {
 *   interface ShortlinkModels extends InferShortlinkModel<typeof shortlinkConfig> {}
 * }
 */
export interface ShortlinkModels {}

/**
 * Falls back to the base `ShortlinkModel` contract until the app augments
 * `ShortlinkModels` (same technique `@adonisjs/auth` uses for guards).
 */
export type ResolvedModel = ShortlinkModels extends { model: infer Model extends ShortlinkModel }
  ? Model
  : ShortlinkModel

/**
 * Infers the configured model from a resolved `defineConfig(...)` provider.
 */
export type InferShortlinkModel<Config extends ConfigProvider<{ model: unknown }>> = {
  model: Awaited<ReturnType<Config['resolver']>>['model']
}

export interface SlugConfig {
  /**
   * Length of generated slugs.
   * @default 8
   */
  length?: number

  /**
   * Alphabet used to generate slugs from. Must contain at least 2 unique
   * characters.
   * @default base62 (A-Za-z0-9)
   */
  alphabet?: string

  /**
   * Pattern custom and generated slugs are validated against.
   * @default /^[A-Za-z0-9_-]{1,255}$/
   */
  pattern?: RegExp

  /**
   * Slugs that can never be assigned (case-insensitive).
   * @default []
   */
  reserved?: string[]

  /**
   * Number of collision retries when generating a slug.
   * @default 5
   */
  maxAttempts?: number
}

export interface ResolvedSlugConfig {
  length: number
  alphabet: string
  pattern: RegExp
  reserved: Set<string>
  maxAttempts: number
}

/**
 * The model's attribute name for each table column the package depends
 * on, resolved once at config-resolve time via
 * `model.$keys.columnsToAttributes`. `metadata` is only present when the
 * model maps that (optional) column.
 */
export interface ResolvedAttributeMap {
  domain: string
  slug: string
  originalUrl: string
  clicks: string
  metadata?: string
}

export interface ShortlinkConfig<Model extends ShortlinkModel = ShortlinkModel> {
  /**
   * The Lucid model to use for shortlink operations. Imported lazily so
   * resolving the config doesn't eagerly load the model module.
   * @example () => import('#models/shortlink')
   */
  model: () => Promise<{ default: Model }>

  /**
   * Primary domain shortlinks are served from. A bare hostname or a full
   * URL — either way it is normalized down to a hostname.
   * @example 'short.domain.com'
   */
  domain: string

  /**
   * Extra hosts served in addition to `domain` (e.g. a legacy domain kept
   * alive during a migration).
   */
  domains?: string[]

  /**
   * @default 'https'
   */
  protocol?: 'http' | 'https'

  /**
   * Path prefix shortlinks are served under.
   * @example 's'
   */
  prefix?: string

  /**
   * HTTP status used for redirects. 301 is cached forever by browsers, so
   * it is not the default — a slug repointed to a new URL would keep
   * redirecting old visitors to the previous destination.
   * @default 302
   */
  redirectStatusCode?: 301 | 302 | 307 | 308

  /**
   * @default true
   */
  trackClicks?: boolean

  slug?: SlugConfig

  /**
   * Protocols an `originalUrl` is allowed to use.
   * @default ['http:', 'https:']
   */
  allowedProtocols?: string[]
}

export interface ResolvedShortlinkConfig<Model extends ShortlinkModel = ShortlinkModel> {
  model: Model
  domain: string
  domains: string[]
  protocol: 'http' | 'https'
  prefix: string
  redirectStatusCode: 301 | 302 | 307 | 308
  trackClicks: boolean
  slug: ResolvedSlugConfig
  allowedProtocols: string[]
  attributes: ResolvedAttributeMap
}

export type QueryOptions = {
  /**
   * Run the query against this client instead of the default connection —
   * typically a transaction.
   */
  client?: QueryClientContract
}

/**
 * Attribute keys `attributes` can never override at the type level. Named
 * after the default (camelCase) contract — a model with a different
 * attribute naming strategy (see `ResolvedAttributeMap`) is still
 * protected at runtime by `ShortlinkService`'s `sanitizeAttributes`, which
 * strips the model's actually-resolved column attributes and primary key;
 * this Omit is a best-effort compile-time guard for the common case, since
 * TypeScript can't reflect on a model's runtime naming strategy.
 */
type ProtectedAttributeKeys = 'id' | 'domain' | 'slug' | 'originalUrl' | 'clicks'

export type CreateOptions<Model extends ShortlinkModel = ShortlinkModel> = QueryOptions & {
  /**
   * A caller-chosen slug. Validated and checked for availability;
   * omit to have one generated.
   */
  slug?: string

  /**
   * Target domain. Must be one of the configured domains, defaults to
   * the primary one.
   */
  domain?: string

  metadata?: Record<string, unknown> | null

  /**
   * Extra app-owned columns (group, createdBy, referer, ...). Cannot
   * override id/slug/domain/originalUrl/clicks — those are always set
   * from the explicit arguments above.
   */
  attributes?: Partial<Omit<ModelAttributes<InstanceType<Model>>, ProtectedAttributeKeys>>
}

export type UpdateChanges<Model extends ShortlinkModel = ShortlinkModel> = {
  originalUrl?: string
  slug?: string
  metadata?: Record<string, unknown> | null

  /**
   * Same override protection as `CreateOptions['attributes']`.
   */
  attributes?: Partial<Omit<ModelAttributes<InstanceType<Model>>, ProtectedAttributeKeys>>
}

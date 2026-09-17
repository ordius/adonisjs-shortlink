/**
 * @ordius/adonisjs-shortlink
 *
 * Type definitions for the Shortlink package
 */

import type { ConfigProvider } from '@adonisjs/core/types'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { LucidModel, LucidRow, ModelAttributes } from '@adonisjs/lucid/types/model'

/**
 * Minimum shape a shortlink row must have. Apps are free to add extra
 * columns (group, createdBy, referer, ...) on top of this contract; they
 * stay reachable through `attributes` on create/update.
 */
export interface ShortlinkRow extends LucidRow {
  id: number | string
  domain: string
  slug: string
  originalUrl: string
  clicks: number
  metadata: Record<string, unknown> | null
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
}

export type QueryOptions = {
  /**
   * Run the query against this client instead of the default connection —
   * typically a transaction.
   */
  client?: QueryClientContract
}

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
  attributes?: Partial<ModelAttributes<InstanceType<Model>>>
}

export type UpdateChanges<Model extends ShortlinkModel = ShortlinkModel> = {
  originalUrl?: string
  slug?: string
  metadata?: Record<string, unknown> | null

  /**
   * Same override protection as `CreateOptions['attributes']`.
   */
  attributes?: Partial<ModelAttributes<InstanceType<Model>>>
}

/**
 * @ordius/adonisjs-shortlink
 */

import { randomInt } from 'node:crypto'

import type { ModelAttributes } from '@adonisjs/lucid/types/model'

import {
  E_INVALID_SLUG,
  E_INVALID_URL,
  E_SLUG_GENERATION_FAILED,
  E_SLUG_RESERVED,
  E_SLUG_TAKEN,
  E_UNKNOWN_DOMAIN,
} from './errors.js'
import type {
  CreateOptions,
  QueryOptions,
  ResolvedModel,
  ResolvedShortlinkConfig,
  ShortlinkModel,
  ShortlinkRow,
  UpdateChanges,
} from './types.js'

/**
 * Detects a unique-constraint violation across the drivers Lucid ships
 * support for, so slug collisions can be retried instead of bubbling up
 * as an opaque database error.
 */
function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; errno?: number; message?: string }

  if (candidate.code === '23505') return true // postgres
  if (candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062) return true // mysql
  if (candidate.code === 'SQLITE_CONSTRAINT_UNIQUE') return true
  if (candidate.code === 'SQLITE_CONSTRAINT' && candidate.message?.includes('UNIQUE')) return true

  return false
}

export default class ShortlinkService<Model extends ShortlinkModel = ResolvedModel> {
  readonly config: ResolvedShortlinkConfig<Model>

  constructor(config: ResolvedShortlinkConfig<Model>) {
    this.config = Object.freeze(config)
  }

  /**
   * Normalizes a bare hostname or full URL down to a hostname, so
   * comparisons against `config.domains` are consistent.
   */
  private normalizeHost(host: string): string {
    const trimmed = host.trim()
    if (!trimmed) return trimmed

    try {
      const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`)
      return url.host
    } catch {
      return trimmed.toLowerCase()
    }
  }

  /**
   * Strips id/slug/domain/originalUrl/clicks from an `attributes` payload
   * so callers can never smuggle a core column through it.
   */
  private sanitizeAttributes(
    attributes?: Partial<ModelAttributes<InstanceType<Model>>>
  ): Record<string, unknown> {
    if (!attributes) return {}
    const { id, domain, slug, originalUrl, clicks, ...rest } = attributes as Record<string, unknown>
    return rest
  }

  /**
   * Asserts a plain attributes bag (built from `domain`/`slug`/etc., all
   * of which are guaranteed present on `ShortlinkRow`) is safe to hand to
   * Lucid's generic `create`/`merge`. `Model` is a bounded generic here,
   * so TS can't structurally verify this itself.
   */
  private asModelAttributes(
    attributes: Record<string, unknown>
  ): Partial<ModelAttributes<InstanceType<Model>>> {
    return attributes as Partial<ModelAttributes<InstanceType<Model>>>
  }

  private assertValidUrl(originalUrl: string): void {
    let parsed: URL

    try {
      parsed = new URL(originalUrl)
    } catch {
      throw new E_INVALID_URL([originalUrl])
    }

    if (!this.config.allowedProtocols.includes(parsed.protocol)) {
      throw new E_INVALID_URL([originalUrl])
    }
  }

  // ---------------------------------------------------------------------
  // URLs — pure
  // ---------------------------------------------------------------------

  servesDomain(host: string): boolean {
    return this.config.domains.includes(this.normalizeHost(host))
  }

  url(slug: string, options?: { domain?: string }): string {
    const domain = options?.domain ? this.normalizeHost(options.domain) : this.config.domain

    if (!this.servesDomain(domain)) {
      throw new E_UNKNOWN_DOMAIN([options?.domain ?? domain])
    }

    return `${this.config.protocol}://${domain}${this.config.prefix}/${slug}`
  }

  parse(shortUrl: string): { domain: string; slug: string } | null {
    let url: URL

    try {
      url = shortUrl.includes('://') ? new URL(shortUrl) : new URL(`https://${shortUrl}`)
    } catch {
      return null
    }

    if (!this.servesDomain(url.host)) return null

    const prefix = this.config.prefix
    let pathname = url.pathname

    if (prefix) {
      if (!pathname.startsWith(`${prefix}/`)) return null
      pathname = pathname.slice(prefix.length)
    }

    const slug = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    if (!slug) return null

    return { domain: url.host, slug }
  }

  // ---------------------------------------------------------------------
  // Slugs — pure
  // ---------------------------------------------------------------------

  /**
   * Generates a slug using `crypto.randomInt`, which draws uniformly from
   * `[0, alphabet.length)` — unlike `byte % alphabet.length`, this never
   * biases towards the low end of the alphabet.
   */
  generateSlug(length: number = this.config.slug.length): string {
    const alphabet = this.config.slug.alphabet
    let result = ''

    for (let i = 0; i < length; i++) {
      result += alphabet[randomInt(alphabet.length)]
    }

    return result
  }

  isReserved(slug: string): boolean {
    return this.config.slug.reserved.has(slug.toLowerCase())
  }

  assertValidSlug(slug: string): void {
    if (!this.config.slug.pattern.test(slug)) {
      throw new E_INVALID_SLUG([slug])
    }

    if (this.isReserved(slug)) {
      throw new E_SLUG_RESERVED([slug])
    }
  }

  // ---------------------------------------------------------------------
  // Reads — domain defaults to primary; an unconfigured domain returns
  // null rather than throwing (throwing is reserved for writes, where an
  // unknown domain is a caller mistake worth surfacing loudly).
  // ---------------------------------------------------------------------

  async find(
    id: ShortlinkRow['id'],
    options: QueryOptions = {}
  ): Promise<InstanceType<Model> | null> {
    return this.config.model.find(
      id,
      options.client ? { client: options.client } : undefined
    ) as Promise<InstanceType<Model> | null>
  }

  async findBySlug(
    slug: string,
    options: { domain?: string } & QueryOptions = {}
  ): Promise<InstanceType<Model> | null> {
    const domain = options.domain ? this.normalizeHost(options.domain) : this.config.domain
    if (!this.servesDomain(domain)) return null

    return this.config.model.findBy(
      { domain, slug },
      options.client ? { client: options.client } : undefined
    ) as Promise<InstanceType<Model> | null>
  }

  async findByUrl(
    originalUrl: string,
    options: { domain?: string } & QueryOptions = {}
  ): Promise<InstanceType<Model> | null> {
    const domain = options.domain ? this.normalizeHost(options.domain) : this.config.domain
    if (!this.servesDomain(domain)) return null

    return this.config.model.findBy(
      { domain, originalUrl },
      options.client ? { client: options.client } : undefined
    ) as Promise<InstanceType<Model> | null>
  }

  // ---------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------

  async create(
    originalUrl: string,
    options: CreateOptions<Model> = {}
  ): Promise<InstanceType<Model>> {
    const url = originalUrl.trim()
    this.assertValidUrl(url)

    const domain = options.domain ? this.normalizeHost(options.domain) : this.config.domain
    if (!this.servesDomain(domain)) {
      throw new E_UNKNOWN_DOMAIN([options.domain ?? domain])
    }

    const clientOptions = options.client ? { client: options.client } : undefined
    const baseAttributes = {
      ...this.sanitizeAttributes(options.attributes),
      domain,
      originalUrl: url,
      clicks: 0,
      metadata: options.metadata ?? null,
    }

    if (options.slug) {
      this.assertValidSlug(options.slug)

      const existing = await this.config.model.findBy({ domain, slug: options.slug }, clientOptions)
      if (existing) throw new E_SLUG_TAKEN([options.slug])

      try {
        return (await this.config.model.create(
          this.asModelAttributes({ ...baseAttributes, slug: options.slug }),
          clientOptions
        )) as InstanceType<Model>
      } catch (error) {
        if (isUniqueViolation(error)) throw new E_SLUG_TAKEN([options.slug])
        throw error
      }
    }

    // A caller-provided transaction can't be retried in: a failed insert
    // aborts it (postgres), so we only retry generated-slug collisions
    // when we own the transaction.
    const maxAttempts = options.client ? 1 : this.config.slug.maxAttempts

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const slug = this.generateSlug()

      const existing = await this.config.model.findBy({ domain, slug }, clientOptions)
      if (existing) continue

      try {
        return (await this.config.model.create(
          this.asModelAttributes({ ...baseAttributes, slug }),
          clientOptions
        )) as InstanceType<Model>
      } catch (error) {
        if (isUniqueViolation(error)) continue
        throw error
      }
    }

    throw new E_SLUG_GENERATION_FAILED()
  }

  /**
   * Idempotent for sequential calls. Concurrent calls without a custom
   * slug can still race into two rows for the same URL — callers who
   * need that guarantee should wrap this in their own lock/transaction.
   */
  async firstOrCreate(
    originalUrl: string,
    options: CreateOptions<Model> = {}
  ): Promise<InstanceType<Model>> {
    const existing = await this.findByUrl(originalUrl, {
      domain: options.domain,
      client: options.client,
    })
    if (existing) return existing

    return this.create(originalUrl, options)
  }

  async update(
    shortlink: InstanceType<Model>,
    changes: UpdateChanges<Model>
  ): Promise<InstanceType<Model>> {
    if (changes.originalUrl !== undefined) {
      const url = changes.originalUrl.trim()
      this.assertValidUrl(url)
      shortlink.originalUrl = url
    }

    if (changes.slug !== undefined && changes.slug !== shortlink.slug) {
      this.assertValidSlug(changes.slug)

      const existing = await this.config.model.findBy({
        domain: shortlink.domain,
        slug: changes.slug,
      })
      if (existing && existing.id !== shortlink.id) {
        throw new E_SLUG_TAKEN([changes.slug])
      }

      shortlink.slug = changes.slug
    }

    if (changes.metadata !== undefined) {
      shortlink.metadata = changes.metadata
    }

    const attributes = this.sanitizeAttributes(changes.attributes)
    if (Object.keys(attributes).length > 0) {
      shortlink.merge(this.asModelAttributes(attributes))
    }

    try {
      await shortlink.save()
    } catch (error) {
      if (changes.slug !== undefined && isUniqueViolation(error)) {
        throw new E_SLUG_TAKEN([changes.slug])
      }
      throw error
    }

    return shortlink
  }

  async delete(shortlink: InstanceType<Model>): Promise<void> {
    await shortlink.delete()
  }

  // ---------------------------------------------------------------------
  // Clicks
  // ---------------------------------------------------------------------

  /**
   * Atomic increment via a raw UPDATE — never touches `updatedAt` and
   * never fires model hooks, so concurrent redirects can't lose counts
   * the way `clicks += 1; save()` would.
   */
  async recordClick(shortlink: InstanceType<Model> | ShortlinkRow['id'], count = 1): Promise<void> {
    const id = typeof shortlink === 'object' ? shortlink.id : shortlink
    await this.config.model.query().where('id', id).increment('clicks', count)
  }
}

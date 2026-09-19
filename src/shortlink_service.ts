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
   * comparisons against `config.domains` are consistent. Ports are dropped:
   * Adonis matches `.domain()` routes and `request.hostname()` without them.
   */
  private normalizeHost(host: string): string {
    const trimmed = host.trim()
    if (!trimmed) return trimmed

    try {
      const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`)
      return url.hostname
    } catch {
      return trimmed.toLowerCase()
    }
  }

  /**
   * Strips the model's primary key and its `domain`/`slug`/`originalUrl`/
   * `clicks` (+ `metadata`, if mapped) attributes from an `attributes`
   * payload, using the attribute names actually resolved for this model
   * (see `ResolvedAttributeMap`) — so callers can never smuggle a core
   * column through it, regardless of the app's naming strategy.
   */
  private sanitizeAttributes(
    // Accepts the public (Omit-narrowed) `attributes` type from
    // `CreateOptions`/`UpdateChanges` as well as the unrestricted one —
    // this is an internal helper, so it only needs to agree with itself.
    attributes?: Record<string, unknown>
  ): Record<string, unknown> {
    if (!attributes) return {}

    const attrs = this.config.attributes
    const protectedKeys = new Set<string>([
      this.config.model.primaryKey,
      attrs.domain,
      attrs.slug,
      attrs.originalUrl,
      attrs.clicks,
    ])
    if (attrs.metadata) protectedKeys.add(attrs.metadata)

    const rest: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(attributes)) {
      if (!protectedKeys.has(key)) rest[key] = value
    }
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

    if (!this.servesDomain(url.hostname)) return null

    const prefix = this.config.prefix
    let pathname = url.pathname

    if (prefix) {
      if (!pathname.startsWith(`${prefix}/`)) return null
      pathname = pathname.slice(prefix.length)
    }

    const slug = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    if (!slug) return null

    return { domain: url.hostname, slug }
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

    const attrs = this.config.attributes
    return this.config.model.findBy(
      { [attrs.domain]: domain, [attrs.slug]: slug },
      options.client ? { client: options.client } : undefined
    ) as Promise<InstanceType<Model> | null>
  }

  async findByUrl(
    originalUrl: string,
    options: { domain?: string } & QueryOptions = {}
  ): Promise<InstanceType<Model> | null> {
    const domain = options.domain ? this.normalizeHost(options.domain) : this.config.domain
    if (!this.servesDomain(domain)) return null

    const attrs = this.config.attributes
    return this.config.model.findBy(
      { [attrs.domain]: domain, [attrs.originalUrl]: originalUrl.trim() },
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

    const attrs = this.config.attributes
    const clientOptions = options.client ? { client: options.client } : undefined
    const baseAttributes: Record<string, unknown> = {
      ...this.sanitizeAttributes(options.attributes),
      [attrs.domain]: domain,
      [attrs.originalUrl]: url,
      [attrs.clicks]: 0,
    }
    // Only written when the model actually maps a metadata column — there
    // is nowhere to put it otherwise.
    if (attrs.metadata) baseAttributes[attrs.metadata] = options.metadata ?? null

    const slugExists = (slug: string) =>
      this.config.model.findBy({ [attrs.domain]: domain, [attrs.slug]: slug }, clientOptions)

    if (options.slug) {
      this.assertValidSlug(options.slug)

      const existing = await slugExists(options.slug)
      if (existing) throw new E_SLUG_TAKEN([options.slug])

      try {
        return (await this.config.model.create(
          this.asModelAttributes({ ...baseAttributes, [attrs.slug]: options.slug }),
          clientOptions
        )) as InstanceType<Model>
      } catch (error) {
        if (!isUniqueViolation(error)) throw error

        // A failed INSERT aborts a caller-provided postgres transaction, so a
        // re-check inside it would fail too — the pre-insert check above is
        // the only collision detection available in that case, and the
        // original DB error (which may be the app's own unique column, not
        // a slug collision) is rethrown as-is.
        if (options.client) throw error

        // No caller transaction: safe to re-check whether the violation was
        // actually this slug, or one of the app's own unique columns
        // (reachable via `attributes`) — only the former is E_SLUG_TAKEN.
        if (await slugExists(options.slug)) throw new E_SLUG_TAKEN([options.slug])
        throw error
      }
    }

    for (let attempt = 0; attempt < this.config.slug.maxAttempts; attempt++) {
      const slug = this.generateSlug()

      // A collision caught here costs nothing, so it is retried in any case.
      const existing = await slugExists(slug)
      if (existing) continue

      try {
        return (await this.config.model.create(
          this.asModelAttributes({ ...baseAttributes, [attrs.slug]: slug }),
          clientOptions
        )) as InstanceType<Model>
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        // Same reasoning as the custom-slug branch above: a caller
        // transaction can't be safely re-checked, so the original error
        // propagates instead of being wrapped in E_SLUG_GENERATION_FAILED.
        if (options.client) throw error
        if (await slugExists(slug)) continue
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
    const attrs = this.config.attributes
    const currentSlug = shortlink.$getAttribute(attrs.slug)

    if (changes.originalUrl !== undefined) {
      const url = changes.originalUrl.trim()
      this.assertValidUrl(url)
      shortlink.$setAttribute(attrs.originalUrl, url)
    }

    let slugChanged = false
    if (changes.slug !== undefined && changes.slug !== currentSlug) {
      this.assertValidSlug(changes.slug)

      const existing = await this.config.model.findBy(
        { [attrs.domain]: shortlink.$getAttribute(attrs.domain), [attrs.slug]: changes.slug },
        shortlink.$trx ? { client: shortlink.$trx } : undefined
      )
      if (existing && existing.$primaryKeyValue !== shortlink.$primaryKeyValue) {
        throw new E_SLUG_TAKEN([changes.slug])
      }

      shortlink.$setAttribute(attrs.slug, changes.slug)
      slugChanged = true
    }

    if (changes.metadata !== undefined && attrs.metadata) {
      shortlink.$setAttribute(attrs.metadata, changes.metadata)
    }

    const attributes = this.sanitizeAttributes(changes.attributes)
    if (Object.keys(attributes).length > 0) {
      shortlink.merge(this.asModelAttributes(attributes))
    }

    try {
      await shortlink.save()
    } catch (error) {
      if (!slugChanged || !isUniqueViolation(error)) throw error

      // A caller transaction can't be safely re-checked (a failed UPDATE
      // aborts it), so the original DB error propagates as-is.
      if (shortlink.$trx) throw error

      // No caller transaction: confirm the violation was actually this
      // slug before reporting it as one — an app's own unique column
      // (reachable via `attributes`) must not be misreported as
      // E_SLUG_TAKEN.
      const existing = await this.config.model.findBy({
        [attrs.domain]: shortlink.$getAttribute(attrs.domain),
        [attrs.slug]: changes.slug,
      })
      if (existing) throw new E_SLUG_TAKEN([changes.slug!])
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
  async recordClick(
    shortlink: InstanceType<Model> | ShortlinkRow['id'],
    count = 1,
    options: QueryOptions = {}
  ): Promise<void> {
    const model = this.config.model
    const id = typeof shortlink === 'object' ? shortlink.$primaryKeyValue : shortlink
    const client = options.client ?? (typeof shortlink === 'object' ? shortlink.$trx : undefined)

    await model
      .query(client ? { client } : undefined)
      .where(model.primaryKey, id!)
      .increment(this.config.attributes.clicks, count)
  }
}

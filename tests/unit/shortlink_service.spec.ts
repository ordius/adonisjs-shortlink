import { test } from '@japa/runner'

import ShortlinkService from '../../src/shortlink_service.js'
import type { ResolvedShortlinkConfig, ShortlinkModel } from '../../src/types.js'

const FakeModel = class {} as unknown as ShortlinkModel

function makeConfig(overrides: Partial<ResolvedShortlinkConfig> = {}): ResolvedShortlinkConfig {
  return {
    model: FakeModel,
    domain: 'short.example.com',
    domains: ['short.example.com'],
    protocol: 'https',
    prefix: '',
    redirectStatusCode: 302,
    trackClicks: true,
    allowedProtocols: ['http:', 'https:'],
    slug: {
      length: 8,
      alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      pattern: /^[A-Za-z0-9_-]{1,255}$/,
      reserved: new Set(),
      maxAttempts: 5,
    },
    ...overrides,
  }
}

test.group('ShortlinkService (pure)', () => {
  test('servesDomain matches configured domains, normalizing input', ({ assert }) => {
    const service = new ShortlinkService(
      makeConfig({ domains: ['short.example.com', 'go.example.com'] })
    )

    assert.isTrue(service.servesDomain('short.example.com'))
    assert.isTrue(service.servesDomain('https://go.example.com/'))
    assert.isFalse(service.servesDomain('unknown.example.com'))
  })

  test('url builds a full URL for the primary domain', ({ assert }) => {
    const service = new ShortlinkService(makeConfig({ prefix: '/s' }))
    assert.equal(service.url('abc123'), 'https://short.example.com/s/abc123')
  })

  test('url throws E_UNKNOWN_DOMAIN for an unconfigured domain', ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    assert.throws(() => service.url('abc123', { domain: 'other.com' }), /is not configured/)
  })

  test('parse extracts domain and slug from a matching short URL', ({ assert }) => {
    const service = new ShortlinkService(makeConfig({ prefix: '/s' }))
    assert.deepEqual(service.parse('https://short.example.com/s/abc123'), {
      domain: 'short.example.com',
      slug: 'abc123',
    })
  })

  test('parse returns null for an unconfigured domain', ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    assert.isNull(service.parse('https://other.example.com/abc123'))
  })

  test('parse returns null when the prefix does not match', ({ assert }) => {
    const service = new ShortlinkService(makeConfig({ prefix: '/s' }))
    assert.isNull(service.parse('https://short.example.com/other/abc123'))
  })

  test('generateSlug produces a slug of the configured length using only alphabet characters', ({
    assert,
  }) => {
    const base = makeConfig()
    const service = new ShortlinkService(
      makeConfig({ slug: { ...base.slug, alphabet: 'ab', length: 20 } })
    )
    const slug = service.generateSlug()

    assert.equal(slug.length, 20)
    assert.isTrue([...slug].every((char) => char === 'a' || char === 'b'))
  })

  test('generateSlug accepts a custom length', ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    assert.equal(service.generateSlug(16).length, 16)
  })

  test('assertValidSlug throws E_INVALID_SLUG for a slug not matching the pattern', ({
    assert,
  }) => {
    const service = new ShortlinkService(makeConfig())
    assert.throws(() => service.assertValidSlug('has spaces'), /does not match/)
  })

  test('assertValidSlug throws E_SLUG_RESERVED case-insensitively', ({ assert }) => {
    const base = makeConfig()
    const service = new ShortlinkService(
      makeConfig({ slug: { ...base.slug, reserved: new Set(['admin']) } })
    )

    assert.throws(() => service.assertValidSlug('Admin'), /reserved/)
    assert.doesNotThrow(() => service.assertValidSlug('not-admin'))
  })

  test('isReserved is case-insensitive', ({ assert }) => {
    const base = makeConfig()
    const service = new ShortlinkService(
      makeConfig({ slug: { ...base.slug, reserved: new Set(['api']) } })
    )

    assert.isTrue(service.isReserved('API'))
    assert.isFalse(service.isReserved('other'))
  })
})

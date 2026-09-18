/**
 * @ordius/adonisjs-shortlink
 *
 * Semantic errors thrown by the shortlink service, built with
 * `createError` so apps can map them to HTTP statuses via `error.code`.
 */

import { createError } from '@adonisjs/core/exceptions'

export const E_SLUG_TAKEN = createError<[slug: string]>(
  'Slug "%s" is already taken',
  'E_SHORTLINK_SLUG_TAKEN',
  409
)

export const E_SLUG_RESERVED = createError<[slug: string]>(
  'Slug "%s" is reserved and cannot be used',
  'E_SHORTLINK_SLUG_RESERVED',
  422
)

export const E_INVALID_SLUG = createError<[slug: string]>(
  'Slug "%s" does not match the configured pattern',
  'E_SHORTLINK_INVALID_SLUG',
  422
)

export const E_INVALID_URL = createError<[url: string]>(
  'Url "%s" is not a valid or allowed URL',
  'E_SHORTLINK_INVALID_URL',
  422
)

export const E_UNKNOWN_DOMAIN = createError<[domain: string]>(
  'Domain "%s" is not configured for shortlinks',
  'E_SHORTLINK_UNKNOWN_DOMAIN',
  422
)

export const E_SLUG_GENERATION_FAILED = createError(
  'Unable to generate a unique slug after multiple attempts',
  'E_SHORTLINK_SLUG_GENERATION_FAILED',
  500
)

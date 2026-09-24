import { supabase } from '../lib/supabase'

/** The shape both PostgREST and GoTrue return on failure. */
type Failure = { message: string; code?: string }

/**
 * A rejected query, with the server's own code kept rather than flattened into
 * a message. Two things need to know more than the text:
 *
 * - the retry queue, which must replay a write that never arrived and must
 *   never replay one the server refused, and
 * - `withFreshSession`, which needs to tell an expired token from a real no.
 *
 * Both decisions are made **here, at the point of failure**, and never by
 * matching strings further up. A provider that sniffs `e.message` is a provider
 * that breaks the day PostgREST rewords something.
 */
export class QueryError extends Error {
  readonly code: string | undefined
  /** The access token had expired. Refreshing and asking again is the answer. */
  readonly stale: boolean
  /** Nothing reached the server, so replaying it later is worth trying. */
  readonly retriable: boolean

  constructor(failure: Failure) {
    super(failure.message)
    this.name = 'QueryError'
    this.code = failure.code
    // PGRST301 is PostgREST's answer to an expired JWT. The message match is a
    // backstop for the paths that 401 without one — GoTrue's own errors, and
    // older PostgREST versions.
    this.stale =
      failure.code === 'PGRST301' ||
      /jwt expired|token is expired|invalid claim/i.test(failure.message)
    // A PostgREST rejection carries a code and is the server saying no; a fetch
    // that never arrived has none, which is what a walk-in cooler looks like
    // from here.
    this.retriable =
      (typeof navigator !== 'undefined' && navigator.onLine === false) || !failure.code
  }
}

export function fail(failure: Failure): never {
  throw new QueryError(failure)
}

/**
 * Run a query; if it was refused because the access token had gone stale,
 * refresh once and run it again.
 *
 * This is the Try again button, pressed for you. An installed app that has been
 * in a pocket since yesterday comes back with an expired access token and a
 * radio that is still reconnecting — supabase-js refreshes on its own, but the
 * first query after a resume can go out before that lands, and PostgREST
 * answers `JWT expired`. Every screen fetches on becoming visible, so that
 * error was the first thing anyone saw after a long gap.
 *
 * Once only. If the refresh itself fails the original error is what surfaces,
 * and if the refresh token is genuinely dead GoTrue emits SIGNED_OUT, which
 * drops the app to the sign-in screen rather than to a red box.
 *
 * Writes are wrapped too, and are safe to run twice: a stale token is refused
 * before the statement executes, so nothing landed the first time.
 */
export async function withFreshSession<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (e) {
    if (!(e instanceof QueryError) || !e.stale) throw e
    const { error } = await supabase.auth.refreshSession()
    if (error) throw e
    return work()
  }
}

/**
 * The one way this app reads from PostgREST: unwrap `{ data, error }`, throw a
 * `QueryError` that knows what kind of failure it was, and refresh once if the
 * token had expired. Keep new queries going through here rather than checking
 * `error` by hand — that is what keeps the two decisions above in one place.
 */
export function query<T>(
  run: () => PromiseLike<{ data: T | null; error: Failure | null }>,
): Promise<T> {
  return withFreshSession(async () => {
    const { data, error } = await run()
    if (error) fail(error)
    // Safe once the error branch has left: PostgREST fills exactly one of the two.
    return data as T
  })
}

/** The same, for a write whose result nobody reads. */
export function execute(run: () => PromiseLike<{ error: Failure | null }>): Promise<void> {
  return withFreshSession(async () => {
    const { error } = await run()
    if (error) fail(error)
  })
}

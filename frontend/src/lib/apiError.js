/**
 * getApiError — extract a human-readable error message from an axios error.
 *
 * Priority:
 *   1. err.response.data.error   — backend JSON payload { error: "…" }
 *   2. err.message               — generic axios message ("Request failed …")
 *   3. fallback                  — caller-supplied string (default: 'Something went wrong')
 *
 * @param {unknown} err
 * @param {string}  [fallback='Something went wrong']
 * @returns {string}
 */
export function getApiError(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error ?? err?.message ?? fallback
}

/**
 * Variables a build genuinely needs. Everything else is dropped rather than
 * denylisted: `vite.config.ts` in a generated project is arbitrary code, so the
 * child must not be able to read platform credentials that we merely forgot to
 * enumerate. An allowlist fails closed when a new secret shows up in the
 * platform's own environment.
 */
const ALLOWED_KEYS = [
  'PATH',
  'HOME',
  'TMPDIR',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  // Windows needs these or spawning node fails outright.
  'SystemRoot',
  'SystemDrive',
  'windir',
  'COMSPEC',
  'PATHEXT',
  'NUMBER_OF_PROCESSORS',
  'PROCESSOR_ARCHITECTURE',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
] as const

/** Unroutable by design, so an accidental proxy read cannot reach a real host. */
const DEAD_PROXY = 'http://127.0.0.1:9'

export interface SandboxEnvOptions {
  /**
   * `blocked` (default) points every proxy variable at a dead address and tells
   * the common toolchains to stay offline. This is mitigation, not isolation:
   * only a container or a network namespace can actually cut a child's network.
   * Anything untrusted needs that layer underneath this one.
   */
  network?: 'blocked' | 'allowed'
  /** Extra variables the caller vouches for (never merged from process.env). */
  extra?: Record<string, string>
}

export function sandboxEnv(
  source: NodeJS.ProcessEnv = process.env,
  options: SandboxEnvOptions = {},
): Record<string, string> {
  const { network = 'blocked', extra = {} } = options
  const env: Record<string, string> = {}

  for (const key of ALLOWED_KEYS) {
    const value = source[key]
    if (value !== undefined) env[key] = value
  }

  // Node's own postinstall/telemetry-ish knobs that would otherwise dial out.
  env.CI = '1'
  env.NO_UPDATE_NOTIFIER = '1'
  env.npm_config_ignore_scripts = 'true'
  env.npm_config_audit = 'false'
  env.npm_config_fund = 'false'

  if (network === 'blocked') {
    env.npm_config_offline = 'true'
    for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY']) {
      env[key] = DEAD_PROXY
    }
    env.NO_PROXY = ''
    env.no_proxy = ''
  }

  return { ...env, ...extra }
}

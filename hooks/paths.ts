// The plugin's folder, worked out from a module's own address
// (<plugin>/hooks/<file>) rather than read off $, which the Claude directory
// accepts only as plain $.noun.method(...) calls.
export function pluginRootFrom(moduleUrl: string | undefined): string | undefined {
  if (moduleUrl === undefined || !moduleUrl.startsWith('file:')) return undefined
  const path = decodeURIComponent(new URL('..', moduleUrl).pathname).replace(/\/$/, '')
  // file:///C:/... has the path /C:/...; drop the slash before a drive letter.
  return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path
}

// Claude Code's .claude folder holds every installed plugin, so it is found
// from the plugin's folder rather than read from the environment. Undefined
// for a plugin run from anywhere else, as `claude --plugin-dir` can.
export function claudeDirFrom(pluginRoot: string | undefined): string | undefined {
  if (pluginRoot === undefined) return undefined
  const at = pluginRoot.lastIndexOf('/.claude/')
  return at === -1 ? undefined : pluginRoot.slice(0, at + '/.claude'.length)
}

export const isWindowsPath = (path: string) => /^[A-Za-z]:\//.test(path)

export const windowsPath = (path: string) => path.replaceAll('/', '\\')

// The plugin's folder, worked out from a module's own address
// (<plugin>/hooks/<file>) rather than read off $, which the Claude directory
// accepts only as plain $.noun.method(...) calls.
export function pluginRootFrom(moduleUrl: string | undefined): string | undefined {
  if (moduleUrl === undefined || !moduleUrl.startsWith('file:')) return undefined
  const path = decodeURIComponent(new URL('..', moduleUrl).pathname).replace(/\/$/, '')
  // file:///C:/... has the path /C:/...; drop the slash before a drive letter.
  return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path
}

export const windowsPath = (path: string) => path.replaceAll('/', '\\')

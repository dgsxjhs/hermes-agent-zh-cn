import { useStore } from '@nanostores/react'
import { createContext, type ReactNode, useContext, useMemo } from 'react'

import { $desktopLocale, setDesktopLocale } from '@/store/locale'

import { desktopCatalog, type DesktopLocale, type DesktopTranslationCatalog, defaultDesktopLocale } from './catalog'

interface LocaleContextValue {
  locale: DesktopLocale
  setLocale: (locale: DesktopLocale) => void
  t: (key: string, params?: Record<string, number | string>) => string
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultDesktopLocale,
  setLocale: () => {},
  t: key => key
})

function lookup(catalog: DesktopTranslationCatalog, key: string): string {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, unknown>)[part]
  }, catalog)

  return typeof value === 'string' ? value : key
}

function format(template: string, params?: Record<string, number | string>) {
  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useStore($desktopLocale)

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: setDesktopLocale,
      t: (key, params) => format(lookup(desktopCatalog[locale] ?? desktopCatalog[defaultDesktopLocale], key), params)
    }),
    [locale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}

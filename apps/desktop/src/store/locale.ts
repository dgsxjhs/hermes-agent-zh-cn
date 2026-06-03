import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

import type { DesktopLocale } from '@/i18n/catalog'
import { defaultDesktopLocale } from '@/i18n/catalog'

const LOCALE_STORAGE_KEY = 'hermes.desktop.locale.v1'

function normalizeDesktopLocale(value: null | string): DesktopLocale {
  return value === 'zh-CN' ? 'zh-CN' : defaultDesktopLocale
}

export const $desktopLocale = atom<DesktopLocale>(normalizeDesktopLocale(storedString(LOCALE_STORAGE_KEY)))

$desktopLocale.subscribe(locale => persistString(LOCALE_STORAGE_KEY, locale))

export function setDesktopLocale(locale: DesktopLocale) {
  $desktopLocale.set(locale)
}


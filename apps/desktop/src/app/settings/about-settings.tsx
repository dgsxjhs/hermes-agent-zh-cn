import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useLocale } from '@/i18n'
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Sparkles } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  $desktopVersion,
  $updateApply,
  $updateChecking,
  $updateStatus,
  checkUpdates,
  openUpdatesWindow,
  refreshDesktopVersion
} from '@/store/updates'

import { ListRow, SectionHeading, SettingsContent } from './primitives'

const RELEASE_NOTES_URL = 'https://github.com/NousResearch/hermes-agent/releases'

function relativeTime(ms: number | undefined, zh: boolean) {
  if (!ms) {
    return zh ? '从未' : 'never'
  }

  const diff = Date.now() - ms

  if (diff < 60_000) {
    return zh ? '刚刚' : 'just now'
  }

  if (diff < 3_600_000) {
    return zh ? `${Math.round(diff / 60_000)} 分钟前` : `${Math.round(diff / 60_000)} min ago`
  }

  if (diff < 86_400_000) {
    return zh ? `${Math.round(diff / 3_600_000)} 小时前` : `${Math.round(diff / 3_600_000)} hours ago`
  }

  return zh ? `${Math.round(diff / 86_400_000)} 天前` : `${Math.round(diff / 86_400_000)} days ago`
}

export function AboutSettings() {
  const { locale } = useLocale()
  const zh = locale === 'zh-CN'
  const version = useStore($desktopVersion)
  const status = useStore($updateStatus)
  const apply = useStore($updateApply)
  const checking = useStore($updateChecking)
  const [justChecked, setJustChecked] = useState(false)

  // The version atom is loaded once at app boot, which makes About show a
  // stale number after a self-update (the running binary is current, the
  // displayed string is not). Re-read on mount so opening About always
  // reflects the running build.
  useEffect(() => {
    void refreshDesktopVersion()
  }, [])

  const behind = status?.behind ?? 0
  const supported = status?.supported !== false
  const applying = apply.applying || apply.stage === 'restart'

  const handleCheck = async () => {
    setJustChecked(false)
    const next = await checkUpdates()
    setJustChecked(Boolean(next))
  }

  let statusLine: string
  let statusTone: 'idle' | 'available' | 'error' = 'idle'

  if (!supported) {
    statusLine = status?.message ?? (zh ? '这个版本暂时不能在应用内自更新。' : "This build can't update itself from inside the app.")
    statusTone = 'error'
  } else if (status?.error) {
    statusLine = zh ? '无法连接更新服务器。' : "We couldn't reach the update server."
    statusTone = 'error'
  } else if (applying) {
    statusLine = zh ? '更新正在安装中。' : 'An update is currently installing.'
    statusTone = 'available'
  } else if (behind > 0) {
    statusLine = zh ? `已有新更新可用（包含 ${behind} 项变更）。` : `A new update is ready (${behind} change${behind === 1 ? '' : 's'} included).`
    statusTone = 'available'
  } else if (status) {
    statusLine = zh ? '当前已经是最新版本。' : "You're on the latest version."
  } else {
    statusLine = zh ? '点“立即检查”来查看更新。' : 'Tap "Check now" to look for updates.'
  }

  return (
    <SettingsContent>
      <div className="flex flex-col items-center gap-3 pt-6 pb-2 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-8" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Hermes Desktop</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {version?.appVersion ? (zh ? `版本 ${version.appVersion}` : `Version ${version.appVersion}`) : (zh ? '版本信息不可用' : 'Version unavailable')}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-2xl">
        <SectionHeading icon={RefreshCw} title={zh ? '更新' : 'Updates'} />

        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            statusTone === 'available' && 'border-primary/30 bg-primary/5 text-foreground',
            statusTone === 'error' && 'border-destructive/35 bg-destructive/5 text-destructive',
            statusTone === 'idle' && 'border-border/70 bg-muted/20 text-foreground'
          )}
        >
          <div className="flex items-start gap-2">
            {statusTone === 'available' ? (
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            ) : statusTone === 'error' ? null : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <div className="min-w-0">
              <p className="font-medium">{statusLine}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {zh ? '上次检查：' : 'Last checked '} {relativeTime(status?.fetchedAt, zh)}
                {justChecked && !checking ? (zh ? ' · 刚刚' : ' · just now') : ''}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              disabled={checking || applying || !supported}
              onClick={() => void handleCheck()}
              size="sm"
              variant="outline"
            >
              {checking ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              {checking ? (zh ? '检查中…' : 'Checking…') : (zh ? '立即检查' : 'Check now')}
            </Button>

            {behind > 0 && supported && !applying && (
              <Button onClick={() => openUpdatesWindow()} size="sm">
                {zh ? '查看更新内容' : "See what's new"}
              </Button>
            )}

            <Button
              asChild
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              size="sm"
              variant="ghost"
            >
              <a
                href={RELEASE_NOTES_URL}
                onClick={event => {
                  event.preventDefault()
                  void window.hermesDesktop?.openExternal?.(RELEASE_NOTES_URL)
                }}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="size-3" />
                {zh ? '发布说明' : 'Release notes'}
              </a>
            </Button>
          </div>
        </div>

        <ListRow
          description={zh ? 'Hermes 会在后台自动检查更新，并在新版本可用时提醒你。' : 'Hermes checks for updates automatically in the background and lets you know when one is ready.'}
          hint={zh ? `分支 ${status?.branch ?? 'unknown'} · 提交 ${status?.currentSha?.slice(0, 7) ?? 'unknown'}` : `Branch ${status?.branch ?? 'unknown'} · Commit ${status?.currentSha?.slice(0, 7) ?? 'unknown'}`}
          title={zh ? '自动更新' : 'Automatic updates'}
        />
      </div>
    </SettingsContent>
  )
}

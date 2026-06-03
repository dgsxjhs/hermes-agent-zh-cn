import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLocale } from '@/i18n'
import { AlertCircle, Check, FileText, Globe, Loader2, Monitor } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import { CONTROL_TEXT } from './constants'
import { EmptyState, ListRow, LoadingState, Pill, SettingsContent } from './primitives'

type Mode = 'local' | 'remote'

interface GatewaySettingsState {
  envOverride: boolean
  mode: Mode
  remoteTokenPreview: string | null
  remoteTokenSet: boolean
  remoteUrl: string
}

const EMPTY_STATE: GatewaySettingsState = {
  envOverride: false,
  mode: 'local',
  remoteTokenPreview: null,
  remoteTokenSet: false,
  remoteUrl: ''
}

function ModeCard({
  active,
  description,
  disabled,
  icon: Icon,
  onSelect,
  title
}: {
  active: boolean
  description: string
  disabled?: boolean
  icon: typeof Monitor
  onSelect: () => void
  title: string
}) {
  return (
    <button
      className={cn(
        'rounded-xl border p-3 text-left transition',
        active
          ? 'border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary)'
          : 'border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) hover:bg-(--chrome-action-hover)',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center gap-2 text-[length:var(--conversation-text-font-size)] font-medium">
        <Icon className="size-4 text-muted-foreground" />
        <span>{title}</span>
        {active ? <Check className="ml-auto size-4 text-primary" /> : null}
      </div>
      <p className="mt-1.5 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
        {description}
      </p>
    </button>
  )
}

export function GatewaySettings() {
  const { locale } = useLocale()
  const zh = locale === 'zh-CN'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [state, setState] = useState<GatewaySettingsState>(EMPTY_STATE)
  const [remoteToken, setRemoteToken] = useState('')
  const [lastTest, setLastTest] = useState<null | string>(null)

  useEffect(() => {
    let cancelled = false
    const desktop = window.hermesDesktop

    if (!desktop?.getConnectionConfig) {
      setLoading(false)

      return () => void (cancelled = true)
    }

    desktop
      .getConnectionConfig()
      .then(config => {
        if (cancelled) {
          return
        }

        setState(config)
      })
      .catch(err => notifyError(err, zh ? '网关设置加载失败' : 'Gateway settings failed to load'))
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => void (cancelled = true)
  }, [])

  const canUseRemote = useMemo(
    () => Boolean(state.remoteUrl.trim()) && (Boolean(remoteToken.trim()) || state.remoteTokenSet),
    [remoteToken, state.remoteTokenSet, state.remoteUrl]
  )

  const payload = () => ({
    mode: state.mode,
    remoteToken: remoteToken.trim() || undefined,
    remoteUrl: state.remoteUrl.trim()
  })

  const save = async (apply: boolean) => {
    if (state.mode === 'remote' && !canUseRemote) {
      notify({
        kind: 'warning',
        title: zh ? '远程网关信息不完整' : 'Remote gateway incomplete',
        message: zh ? '切换到远程模式前，请先填写远程地址和会话令牌。' : 'Enter a remote URL and session token before switching to remote.'
      })

      return
    }

    setSaving(true)

    try {
      const next = apply
        ? await window.hermesDesktop.applyConnectionConfig(payload())
        : await window.hermesDesktop.saveConnectionConfig(payload())

      setState(next)
      setRemoteToken('')
      notify({
        kind: 'success',
        title: apply ? (zh ? '网关连接正在重启' : 'Gateway connection restarting') : (zh ? '网关设置已保存' : 'Gateway settings saved'),
        message: apply ? (zh ? 'Hermes Desktop 会用保存后的设置重新连接。' : 'Hermes Desktop will reconnect using the saved settings.') : (zh ? '已保存，下次重启后生效。' : 'Saved for the next restart.')
      })
    } catch (err) {
      notifyError(err, apply ? (zh ? '应用网关设置失败' : 'Could not apply gateway settings') : (zh ? '保存网关设置失败' : 'Could not save gateway settings'))
    } finally {
      setSaving(false)
    }
  }

  const testRemote = async () => {
    if (!canUseRemote) {
      notify({
        kind: 'warning',
        title: zh ? '远程网关信息不完整' : 'Remote gateway incomplete',
        message: zh ? '测试前，请先填写远程地址和会话令牌。' : 'Enter a remote URL and session token before testing.'
      })

      return
    }

    setTesting(true)
    setLastTest(null)

    try {
      const result = await window.hermesDesktop.testConnectionConfig({
        mode: 'remote',
        remoteToken: remoteToken.trim() || undefined,
        remoteUrl: state.remoteUrl.trim()
      })

      const message = `Connected to ${result.baseUrl}${result.version ? ` · Hermes ${result.version}` : ''}`
      setLastTest(message)
      notify({ kind: 'success', title: zh ? '远程网关可连接' : 'Remote gateway reachable', message })
    } catch (err) {
      notifyError(err, zh ? '远程网关测试失败' : 'Remote gateway test failed')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <LoadingState label={zh ? '正在加载网关设置…' : 'Loading gateway settings...'} />
  }

  if (!window.hermesDesktop?.getConnectionConfig) {
    return (
        <EmptyState
        description={zh ? '当前桌面 IPC 桥没有暴露网关设置能力。' : 'The desktop IPC bridge does not expose gateway settings.'}
        title={zh ? '网关设置不可用' : 'Gateway settings unavailable'}
      />
    )
  }

  return (
    <SettingsContent>
      <div className="mb-5">
        <div className="flex items-center gap-2 text-[length:var(--conversation-text-font-size)] font-medium">
          <Globe className="size-4 text-muted-foreground" />
          {zh ? '网关连接' : 'Gateway Connection'}
          {state.envOverride ? <Pill tone="primary">{zh ? '环境变量覆盖' : 'env override'}</Pill> : null}
        </div>
        <p className="mt-2 max-w-2xl text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
          {zh
            ? '默认情况下，Hermes Desktop 会启动自己的本地网关。如果你想让这个桌面端去控制另一台机器上已经在运行的 Hermes 后端，或者走受信任代理后的后端，就改用远程网关。'
            : 'Hermes Desktop starts its own local gateway by default. Use a remote gateway when you want this app to control an already-running Hermes backend on another machine or behind a trusted proxy.'}
        </p>
      </div>

      {state.envOverride ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[length:var(--conversation-caption-font-size)] text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-medium">{zh ? '这个桌面会话当前受环境变量控制。' : 'Environment variables are controlling this desktop session.'}</div>
            <div className="mt-1 leading-5">
              {zh ? <>取消 <code>HERMES_DESKTOP_REMOTE_URL</code> 和 <code>HERMES_DESKTOP_REMOTE_TOKEN</code> 后，下面保存的设置才会生效。</> : <>Unset <code>HERMES_DESKTOP_REMOTE_URL</code> and <code>HERMES_DESKTOP_REMOTE_TOKEN</code> to use the saved setting below.</>}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={state.mode === 'local'}
          description={zh ? '在 localhost 上启动一套私有 Hermes 后端。这是默认方式，离线也能用。' : 'Start a private Hermes backend on localhost. This is the default and works offline.'}
          disabled={state.envOverride}
          icon={Monitor}
          onSelect={() => setState(current => ({ ...current, mode: 'local' }))}
          title={zh ? '本地网关' : 'Local gateway'}
        />
        <ModeCard
          active={state.mode === 'remote'}
          description={zh ? '用会话令牌把这个桌面端连接到远程 Hermes 后端。' : 'Connect this desktop shell to a remote Hermes backend using its session token.'}
          disabled={state.envOverride}
          icon={Globe}
          onSelect={() => setState(current => ({ ...current, mode: 'remote' }))}
          title={zh ? '远程网关' : 'Remote gateway'}
        />
      </div>

      <div className="mt-5 divide-y divide-border/40">
        <ListRow
          action={
            <Input
              className={cn('h-8', CONTROL_TEXT)}
              disabled={state.envOverride}
              onChange={event => setState(current => ({ ...current, remoteUrl: event.target.value }))}
              placeholder="https://gateway.example.com/hermes"
              value={state.remoteUrl}
            />
          }
          description={zh ? '远程 dashboard 后端的基础 URL。支持带路径前缀，比如 /hermes。' : 'Base URL for the remote dashboard backend. Path prefixes are supported, for example /hermes.'}
          title={zh ? '远程地址' : 'Remote URL'}
        />
        <ListRow
          action={
            <Input
              autoComplete="off"
              className={cn('h-8 font-mono', CONTROL_TEXT)}
              disabled={state.envOverride}
              onChange={event => setRemoteToken(event.target.value)}
              placeholder={
                state.remoteTokenSet ? `Existing token ${state.remoteTokenPreview ?? 'saved'}` : 'Paste session token'
              }
              type="password"
              value={remoteToken}
            />
          }
          description={zh ? '用于 REST 和 WebSocket 访问的 dashboard 会话令牌。留空则保留已保存的令牌。' : 'The dashboard session token used for REST and WebSocket access. Leave blank to keep the saved token.'}
          title={zh ? '会话令牌' : 'Session token'}
        />
      </div>

      {lastTest ? <div className="mt-4 text-xs text-primary">{lastTest}</div> : null}

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          disabled={state.envOverride || testing || !canUseRemote}
          onClick={() => void testRemote()}
          variant="outline"
        >
          {testing ? <Loader2 className="size-4 animate-spin" /> : null}
          {zh ? '测试远程连接' : 'Test remote'}
        </Button>
        <Button disabled={state.envOverride || saving} onClick={() => void save(false)} variant="outline">
          {zh ? '保存，下次重启生效' : 'Save for next restart'}
        </Button>
        <Button disabled={state.envOverride || saving} onClick={() => void save(true)}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {zh ? '保存并重连' : 'Save and reconnect'}
        </Button>
      </div>

      <div className="mt-6 divide-y divide-border/40">
        <ListRow
          action={
            <Button onClick={() => void window.hermesDesktop?.revealLogs()} variant="outline">
              <FileText className="size-4" />
              {zh ? '打开日志' : 'Open logs'}
            </Button>
          }
          description={zh ? '在文件管理器里打开 desktop.log。网关启动失败时，这里最有用。' : 'Reveal desktop.log in your file manager — useful when the gateway fails to start.'}
          title={zh ? '诊断' : 'Diagnostics'}
        />
      </div>
    </SettingsContent>
  )
}

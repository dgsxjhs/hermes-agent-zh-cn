import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { writeClipboardText } from '@/components/ui/copy-button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useLocale } from '@/i18n'
import type { DesktopUpdateCommit, DesktopUpdateStage, DesktopUpdateStatus } from '@/global'
import { buildCommitChangelog, type CommitGroup } from '@/lib/commit-changelog'
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, Sparkles, Terminal } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  $updateApply,
  $updateChecking,
  $updateOverlayOpen,
  $updateStatus,
  applyUpdates,
  checkUpdates,
  resetUpdateApplyState,
  setUpdateOverlayOpen,
  type UpdateApplyState
} from '@/store/updates'

const STAGE_LABELS: Record<DesktopUpdateStage, string> = {
  idle: 'Getting ready…',
  prepare: 'Getting ready…',
  fetch: 'Downloading…',
  pull: 'Almost there…',
  pydeps: 'Finishing up…',
  restart: 'Restarting Hermes…',
  manual: 'Update from your terminal',
  error: 'Update paused'
}

function totalItems(groups: readonly CommitGroup[]) {
  return groups.reduce((sum, g) => sum + g.items.length, 0)
}

export function UpdatesOverlay() {
  const { locale } = useLocale()
  const zh = locale.startsWith('zh')
  const open = useStore($updateOverlayOpen)
  const status = useStore($updateStatus)
  const checking = useStore($updateChecking)
  const apply = useStore($updateApply)

  useEffect(() => {
    if (open && !status && !checking) {
      void checkUpdates()
    }
  }, [checking, open, status])

  const behind = status?.behind ?? 0

  const phase: 'idle' | 'applying' | 'manual' | 'error' =
    apply.stage === 'manual'
      ? 'manual'
      : apply.applying || apply.stage === 'restart'
        ? 'applying'
        : apply.stage === 'error'
          ? 'error'
          : 'idle'

  const handleClose = (next: boolean) => {
    if (phase === 'applying') {
      return
    }

    setUpdateOverlayOpen(next)

    if (!next && (apply.stage === 'error' || apply.stage === 'restart' || apply.stage === 'manual')) {
      resetUpdateApplyState()
    }
  }

  const handleInstall = () => {
    void applyUpdates()
  }

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent
        className="max-w-sm overflow-hidden border-border/70 p-0 gap-0"
        showCloseButton={phase !== 'applying'}
      >
        {phase === 'applying' && <ApplyingView apply={apply} zh={zh} />}

        {phase === 'manual' && (
          <ManualView command={apply.command ?? 'hermes update'} onDone={() => handleClose(false)} zh={zh} />
        )}

        {phase === 'error' && (
          <ErrorView message={apply.message} onDismiss={() => handleClose(false)} onRetry={handleInstall} zh={zh} />
        )}

        {phase === 'idle' && (
          <IdleView
            behind={behind}
            checking={checking}
            commits={status?.commits ?? []}
            onInstall={handleInstall}
            onLater={() => handleClose(false)}
            onRetryCheck={() => void checkUpdates()}
            status={status}
            zh={zh}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function IdleView({
  behind,
  checking,
  commits,
  onInstall,
  onLater,
  onRetryCheck,
  status,
  zh
}: {
  behind: number
  checking: boolean
  commits: readonly DesktopUpdateCommit[]
  onInstall: () => void
  onLater: () => void
  onRetryCheck: () => void
  status: DesktopUpdateStatus | null
  zh: boolean
}) {
  if (!status && checking) {
    return (
      <CenteredStatus icon={<Loader2 className="size-6 animate-spin text-primary" />} title={zh ? '正在检查更新…' : 'Looking for updates…'} />
    )
  }

  if (!status) {
    return (
      <CenteredStatus
        action={
          <Button onClick={onRetryCheck} size="sm">
            {zh ? '再试一次' : 'Try again'}
          </Button>
        }
        icon={<AlertCircle className="size-6 text-muted-foreground" />}
        title={zh ? '检查更新失败' : 'Couldn’t check for updates'}
      />
    )
  }

  if (!status.supported) {
    return (
      <CenteredStatus
        action={
          <Button onClick={onLater} size="sm" variant="outline">
            {zh ? '关闭' : 'Close'}
          </Button>
        }
        body={status.message ?? (zh ? '这个版本暂时不能在应用里直接更新。' : 'This version of Hermes can’t update itself from inside the app.')}
        icon={<AlertCircle className="size-6 text-muted-foreground" />}
        title={zh ? '暂时不能更新' : 'Update not available'}
      />
    )
  }

  if (status.error) {
    return (
      <CenteredStatus
        action={
          <Button disabled={checking} onClick={onRetryCheck} size="sm">
            {zh ? '再试一次' : 'Try again'}
          </Button>
        }
        body={zh ? '检查一下网络连接，然后再试一次。' : 'Check your connection and try again.'}
        icon={<AlertCircle className="size-6 text-muted-foreground" />}
        title={zh ? '检查更新失败' : 'Couldn’t check for updates'}
      />
    )
  }

  if (behind === 0) {
    return (
      <CenteredStatus
        action={
          <Button onClick={onLater} size="sm" variant="outline">
            {zh ? '关闭' : 'Close'}
          </Button>
        }
        body={zh ? '你现在已经是最新版本。' : 'You’re running the latest version.'}
        icon={<CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />}
        title={zh ? '已经是最新了' : 'You’re all set'}
      />
    )
  }

  const groups = buildCommitChangelog(commits)
  const shownItems = totalItems(groups)
  const remaining = Math.max(0, behind - shownItems)

  return (
    <div className="grid gap-5 px-6 pb-6 pt-7 pr-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-7" />
        </span>

        <DialogTitle className="text-center text-xl">{zh ? '发现新版本' : 'New update available'}</DialogTitle>
        <DialogDescription className="text-center text-sm">{zh ? '新的 Hermes 版本已经可以安装了。' : 'A new version of Hermes is ready to install.'}</DialogDescription>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
        {groups.map(group => (
          <div key={group.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {zh
                ? ({
                    "What's new": '新内容',
                    Fixed: '修复',
                    Faster: '性能',
                    Improved: '改进'
                  }[group.label] ?? group.label)
                : group.label}
            </p>
            <ul className="mt-1.5 grid gap-1.5 text-sm text-foreground">
              {group.items.map(item => (
                <li className="flex items-start gap-2" key={item}>
                  <span aria-hidden className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <Button className="h-10 text-sm font-semibold" onClick={onInstall} size="default">
          {zh ? '立即更新' : 'Update now'}
        </Button>
        <button
          className="text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={onLater}
          type="button"
        >
          {zh ? '稍后再说' : 'Maybe later'}
        </button>
      </div>

      {remaining > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {zh ? `另外还有 ${remaining} 条改动。` : `+ ${remaining} more change${remaining === 1 ? '' : 's'} included.`}
        </p>
      )}
    </div>
  )
}

function ManualView({ command, onDone, zh }: { command: string; onDone: () => void; zh: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void writeClipboardText(command).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="grid gap-5 px-6 pb-6 pt-7 pr-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Terminal className="size-7" />
        </span>

        <DialogTitle className="text-center text-xl">{zh ? '请在终端里更新' : 'Update from your terminal'}</DialogTitle>
        <DialogDescription className="text-center text-sm">{zh ? '你这套 Hermes 是命令行安装的，所以更新也要在终端里跑。把下面这条命令贴进终端：' : 'You installed Hermes from the command line, so updates run there too. Paste this into your terminal:'}</DialogDescription>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-left transition-colors hover:border-border hover:bg-muted/50"
      >
        <code className="select-all font-mono text-sm text-foreground">
          <span className="text-muted-foreground">$ </span>
          {command}
        </code>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              {zh ? '已复制' : 'Copied'}
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              {zh ? '复制' : 'Copy'}
            </>
          )}
        </span>
      </button>

      <p className="text-center text-xs text-muted-foreground">
        {zh ? '下次启动 Hermes 时，就会用上新版本。' : 'Hermes will pick up the new version next time you launch it.'}
      </p>

      <Button className="h-10 text-sm font-semibold" onClick={onDone} variant="outline">
        {zh ? '完成' : 'Done'}
      </Button>
    </div>
  )
}

function ApplyingView({ apply, zh }: { apply: UpdateApplyState; zh: boolean }) {
  const label = zh
    ? ({
        idle: '准备中…',
        prepare: '准备中…',
        fetch: '下载中…',
        pull: '快完成了…',
        pydeps: '正在收尾…',
        restart: '正在重启 Hermes…',
        manual: '请在终端里更新',
        error: '更新已暂停'
      }[apply.stage] ?? '正在更新 Hermes…')
    : (STAGE_LABELS[apply.stage] ?? 'Updating Hermes…')

  const percent =
    typeof apply.percent === 'number' && Number.isFinite(apply.percent)
      ? Math.max(2, Math.min(100, Math.round(apply.percent)))
      : null

  return (
    <div className="grid gap-5 px-6 pb-6 pt-7">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="relative flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Loader2 className="size-7 animate-spin" />
        </span>

        <DialogTitle className="text-center text-xl">{label}</DialogTitle>
        <DialogDescription className="text-center text-sm">
          {zh ? '更新器会接管自己的窗口，完成后会重新打开 Hermes。' : 'The Hermes updater will take over in its own window and reopen Hermes when it&rsquo;s done.'}
        </DialogDescription>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full bg-primary transition-[width] duration-300 ease-out',
            percent === null && 'w-1/3 animate-pulse'
          )}
          style={percent !== null ? { width: `${percent}%` } : undefined}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">{zh ? '应用更新时，Hermes 会先关闭。' : 'Hermes will close to apply the update.'}</p>
    </div>
  )
}

function ErrorView({ message, onDismiss, onRetry, zh }: { message: string; onDismiss: () => void; onRetry: () => void; zh: boolean }) {
  return (
    <div className="grid gap-5 px-6 pb-6 pt-7 pr-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-7" />
        </span>

        <DialogTitle className="text-center text-xl">{zh ? '更新没有完成' : 'Update didn’t finish'}</DialogTitle>
        <DialogDescription className="text-center text-sm">{message || (zh ? '别担心，数据没有丢。现在可以再试一次。' : 'No worries — nothing was lost. You can try again now.')}</DialogDescription>
      </div>

      <div className="grid gap-2">
        <Button className="h-10 text-sm font-semibold" onClick={onRetry}>
          {zh ? '再试一次' : 'Try again'}
        </Button>
        <button
          className="text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={onDismiss}
          type="button"
        >
          {zh ? '暂时不用' : 'Not now'}
        </button>
      </div>
    </div>
  )
}

function CenteredStatus({
  action,
  body,
  icon,
  title
}: {
  action?: React.ReactNode
  body?: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <div className="grid gap-4 px-6 pb-6 pt-8 pr-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted/40">{icon}</span>

        <DialogTitle className="text-center text-lg">{title}</DialogTitle>
        {body && <DialogDescription className="text-center text-sm">{body}</DialogDescription>}
      </div>

      {action && <div className="flex justify-center">{action}</div>}
    </div>
  )
}

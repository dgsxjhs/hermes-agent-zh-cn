import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { deleteSession, listSessions, setSessionArchived } from '@/hermes'
import { useLocale } from '@/i18n'
import { sessionTitle } from '@/lib/chat-runtime'
import { triggerHaptic } from '@/lib/haptics'
import { Archive, ArchiveOff, FolderOpen, Loader2, Trash2 } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { setSessions } from '@/store/session'
import type { SessionInfo } from '@/types/hermes'

import { EmptyState, ListRow, LoadingState, SectionHeading, SettingsContent } from './primitives'
import type { SearchProps } from './types'

const ARCHIVED_FETCH_LIMIT = 200

function workspaceLabel(cwd: null | string | undefined): string {
  const path = cwd?.trim()

  if (!path) {
    return ''
  }

  return (
    path
      .replace(/[/\\]+$/, '')
      .split(/[/\\]/)
      .filter(Boolean)
      .pop() ?? path
  )
}

export function SessionsSettings({ query }: SearchProps) {
  const { locale } = useLocale()
  const zh = locale === 'zh-CN'
  const [sessions, setLocalSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const result = await listSessions(ARCHIVED_FETCH_LIMIT, 0, 'only')
      setLocalSessions(result.sessions)
    } catch (err) {
      notifyError(err, zh ? '加载归档会话失败' : 'Could not load archived sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const unarchive = useCallback(async (session: SessionInfo) => {
    setBusyId(session.id)

    try {
      await setSessionArchived(session.id, false)
      setLocalSessions(prev => prev.filter(s => s.id !== session.id))
      // Surface it again in the sidebar without waiting for a full refresh.
      setSessions(prev => [{ ...session, archived: false }, ...prev.filter(s => s.id !== session.id)])
      triggerHaptic('selection')
      notify({ durationMs: 2_000, kind: 'success', message: zh ? '已恢复' : 'Restored' })
    } catch (err) {
      notifyError(err, zh ? '取消归档失败' : 'Unarchive failed')
    } finally {
      setBusyId(null)
    }
  }, [])

  const remove = useCallback(async (session: SessionInfo) => {
    if (!window.confirm(zh ? `要永久删除“${sessionTitle(session)}”吗？此操作无法撤销。` : `Permanently delete "${sessionTitle(session)}"? This cannot be undone.`)) {
      return
    }

    setBusyId(session.id)

    try {
      await deleteSession(session.id)
      setLocalSessions(prev => prev.filter(s => s.id !== session.id))
      triggerHaptic('warning')
    } catch (err) {
      notifyError(err, zh ? '删除失败' : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (!needle) {
      return sessions
    }

    return sessions.filter(session =>
      [sessionTitle(session), session.preview ?? '', session.cwd ?? ''].join(' ').toLowerCase().includes(needle)
    )
  }, [query, sessions])

  if (loading) {
    return <LoadingState label={zh ? '正在加载归档会话…' : 'Loading archived sessions…'} />
  }

  return (
    <SettingsContent>
      <DefaultProjectDirSetting />

      <SectionHeading
        icon={Archive}
        meta={sessions.length ? String(sessions.length) : undefined}
        title={zh ? '已归档会话' : 'Archived sessions'}
      />
      <p className="mb-2 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
        {zh ? '归档后的聊天会从侧边栏隐藏，但消息会完整保留。在侧边栏里对某个聊天按 Ctrl/⌘ 点击即可归档。' : 'Archived chats are hidden from the sidebar but keep all their messages. Ctrl/⌘-click a chat in the sidebar to archive it.'}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          description={query.trim() ? (zh ? '没有匹配你搜索条件的归档聊天。' : 'No archived chats match your search.') : (zh ? '先归档一个聊天，它就会显示在这里。' : 'Archive a chat to hide it here.')}
          title={zh ? '还没有归档内容' : 'Nothing archived'}
        />
      ) : (
        <div className="divide-y divide-border/30">
          {filtered.map(session => {
            const label = workspaceLabel(session.cwd)
            const busy = busyId === session.id

            return (
              <ListRow
                action={
                  <div className="flex items-center gap-1.5">
                    <Button
                      disabled={busy}
                      onClick={() => void unarchive(session)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ArchiveOff className="size-3.5" />}
                      <span>{zh ? '取消归档' : 'Unarchive'}</span>
                    </Button>
                    <Button
                      aria-label={zh ? '永久删除' : 'Delete permanently'}
                      className="text-muted-foreground hover:text-destructive"
                      disabled={busy}
                      onClick={() => void remove(session)}
                      size="icon"
                      title={zh ? '永久删除' : 'Delete permanently'}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                }
                description={session.preview || undefined}
                hint={label ? `${label} · ${session.message_count} messages` : `${session.message_count} messages`}
                key={session.id}
                title={sessionTitle(session)}
              />
            )
          })}
        </div>
      )}
    </SettingsContent>
  )
}

// Lets the user pin the default cwd for new sessions. Without this, packaged
// builds on Windows used to spawn sessions in the install dir (`win-unpacked`
// / Program Files), which buried any files Hermes wrote there.
function DefaultProjectDirSetting() {
  const { locale } = useLocale()
  const zh = locale === 'zh-CN'
  const [dir, setDir] = useState<null | string>(null)
  const [fallback, setFallback] = useState<string>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // The bridge is only present when running inside Electron. In a Vitest
    // / Storybook / non-Electron context `window.hermesDesktop` is
    // undefined, so guard the WHOLE call chain rather than chaining
    // `?.settings.getDefaultProjectDir().then(...)` (the latter would
    // short-circuit to `undefined.then(...)` and throw at runtime).
    const settings = window.hermesDesktop?.settings

    if (!settings) {
      return
    }

    let alive = true

    void settings.getDefaultProjectDir().then(result => {
      if (!alive) return
      setDir(result.dir)
      setFallback(result.defaultLabel)
    })

    return () => {
      alive = false
    }
  }, [])

  const choose = useCallback(async () => {
    const settings = window.hermesDesktop?.settings

    if (!settings) return

    setBusy(true)

    try {
      const picked = await settings.pickDefaultProjectDir()

      if (picked.canceled || !picked.dir) {
        return
      }

      const result = await settings.setDefaultProjectDir(picked.dir)
      setDir(result.dir)
      notify({ durationMs: 2_000, kind: 'success', message: zh ? '默认项目目录已更新' : 'Default project directory updated' })
    } catch (err) {
      notifyError(err, zh ? '更新默认目录失败' : 'Could not update default directory')
    } finally {
      setBusy(false)
    }
  }, [])

  const clear = useCallback(async () => {
    const settings = window.hermesDesktop?.settings

    if (!settings) return

    setBusy(true)

    try {
      await settings.setDefaultProjectDir(null)
      setDir(null)
    } catch (err) {
      notifyError(err, zh ? '清除默认目录失败' : 'Could not clear default directory')
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <div className="mb-6">
      <SectionHeading icon={FolderOpen} title={zh ? '默认项目目录' : 'Default project directory'} />
      <p className="mb-2 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
        {zh ? '新会话默认从这个文件夹开始，除非你手动选了别的目录。留空则使用你的 home 目录。' : 'New sessions start in this folder unless you pick another. Leave it unset to use your home directory.'}
      </p>
      <ListRow
        action={
          <div className="flex items-center gap-1.5">
            <Button disabled={busy} onClick={() => void choose()} size="sm" type="button" variant="outline">
              <FolderOpen className="size-3.5" />
              <span>{dir ? (zh ? '更改' : 'Change') : (zh ? '选择' : 'Choose')}</span>
            </Button>
            {dir && (
              <Button disabled={busy} onClick={() => void clear()} size="sm" type="button" variant="ghost">
                {zh ? '清除' : 'Clear'}
              </Button>
            )}
          </div>
        }
        description={dir || (zh ? `默认会用 ${fallback || '~/hermes-projects'}。` : `Defaults to ${fallback || '~/hermes-projects'}.`)}
        title={dir ? dir : (zh ? '未设置' : 'Not set')}
      />
    </div>
  )
}

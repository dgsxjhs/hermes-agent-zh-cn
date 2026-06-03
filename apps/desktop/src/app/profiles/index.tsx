import type * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PageLoader } from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createProfile,
  deleteProfile,
  getProfiles,
  getProfileSetupCommand,
  getProfileSoul,
  type ProfileInfo,
  renameProfile,
  updateProfileSoul
} from '@/hermes'
import { useLocale } from '@/i18n'
import { AlertTriangle, Pencil, Save, Terminal, Trash2, Users } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import type { SetStatusbarItemGroup } from '../shell/statusbar-controls'
import { titlebarHeaderBaseClass } from '../shell/titlebar'
import type { SetTitlebarToolGroup } from '../shell/titlebar-controls'

const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

const PROFILE_NAME_HINT = 'Lowercase letters, digits, hyphens, and underscores. Must start with a letter or digit.'

function isValidProfileName(name: string): boolean {
  return PROFILE_NAME_RE.test(name.trim())
}

interface ProfilesViewProps extends React.ComponentProps<'section'> {
  setStatusbarItemGroup?: SetStatusbarItemGroup
  setTitlebarToolGroup?: SetTitlebarToolGroup
}

export function ProfilesView({
  setStatusbarItemGroup: _setStatusbarItemGroup,
  setTitlebarToolGroup,
  ...props
}: ProfilesViewProps) {
  const { locale } = useLocale()
  const zh = locale.startsWith('zh')
  const [profiles, setProfiles] = useState<null | ProfileInfo[]>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedName, setSelectedName] = useState<null | string>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<null | ProfileInfo>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)

    try {
      const { profiles: list } = await getProfiles()
      setProfiles(list)
      setSelectedName(current => {
        if (current && list.some(p => p.name === current)) {
          return current
        }

        return list.find(p => p.is_default)?.name ?? list[0]?.name ?? null
      })
    } catch (err) {
      notifyError(err, zh ? '加载配置档案失败' : 'Failed to load profiles')
    } finally {
      setRefreshing(false)
    }
  }, [zh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!setTitlebarToolGroup) {
      return
    }

    setTitlebarToolGroup('profiles', [
      {
        disabled: refreshing,
        icon: <Codicon name="refresh" spinning={refreshing} />,
        id: 'refresh-profiles',
        label: refreshing ? (zh ? '正在刷新配置档案' : 'Refreshing profiles') : zh ? '刷新配置档案' : 'Refresh profiles',
        onSelect: () => void refresh()
      }
    ])

    return () => setTitlebarToolGroup('profiles', [])
  }, [refresh, refreshing, setTitlebarToolGroup, zh])

  const selected = useMemo(() => {
    if (!profiles) {
      return null
    }

    return profiles.find(p => p.name === selectedName) ?? profiles[0] ?? null
  }, [profiles, selectedName])

  const handleCreate = useCallback(
    async (name: string, cloneFromDefault: boolean) => {
      const trimmed = name.trim()

      if (!isValidProfileName(trimmed)) {
        throw new Error(PROFILE_NAME_HINT)
      }

      await createProfile({ name: trimmed, clone_from_default: cloneFromDefault })
      notify({ kind: 'success', title: 'Profile created', message: trimmed })
      setSelectedName(trimmed)
      await refresh()
    },
    [refresh]
  )

  const handleRename = useCallback(
    async (from: string, to: string): Promise<void> => {
      const target = to.trim()

      if (target === from) {
        return
      }

      if (!isValidProfileName(target)) {
        throw new Error(PROFILE_NAME_HINT)
      }

      await renameProfile(from, target)
      notify({ kind: 'success', title: 'Profile renamed', message: `${from} → ${target}` })
      setSelectedName(target)
      await refresh()
    },
    [refresh]
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) {
      return
    }

    setDeleting(true)

    try {
      await deleteProfile(pendingDelete.name)
      notify({ kind: 'success', title: 'Profile deleted', message: pendingDelete.name })
      setPendingDelete(null)
      setSelectedName(null)
      await refresh()
    } catch (err) {
      notifyError(err, 'Failed to delete profile')
    } finally {
      setDeleting(false)
    }
  }, [pendingDelete, refresh])

  return (
    <section {...props} className="flex h-full min-w-0 flex-col overflow-hidden rounded-b-[0.9375rem] bg-background">
      <header className={titlebarHeaderBaseClass}>
        <h2 className="pointer-events-auto text-base font-semibold leading-none tracking-tight">{zh ? '配置档案' : 'Profiles'}</h2>
        <span className="pointer-events-auto text-xs text-muted-foreground">
          {profiles ? (zh ? `${profiles.length} 个配置档案` : `${profiles.length} ${profiles.length === 1 ? 'profile' : 'profiles'}`) : ''}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-b-[1.0625rem] border border-border/50 bg-background/85">
        {!profiles ? (
          <PageLoader label={zh ? '正在加载配置档案...' : 'Loading profiles...'} />
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col overflow-hidden border-b border-border/50 lg:border-b-0 lg:border-r">
              <div className="border-b border-border/40 p-2">
                <Button className="w-full" onClick={() => setCreateOpen(true)} size="sm">
                  <Codicon name="add" />
                  {zh ? '新建配置档案' : 'New profile'}
                </Button>
              </div>
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {profiles.map(profile => (
                  <li key={profile.name}>
                    <ProfileRow
                      active={selected?.name === profile.name}
                      onSelect={() => setSelectedName(profile.name)}
                      profile={profile}
                    />
                  </li>
                ))}
                {profiles.length === 0 && (
                  <li className="px-2 py-4 text-center text-xs text-muted-foreground">{zh ? '还没有配置档案。' : 'No profiles yet.'}</li>
                )}
              </ul>
            </aside>

            <main className="min-h-0 overflow-hidden">
              {selected ? (
                <ProfileDetail
                  key={selected.name}
                  onDelete={() => setPendingDelete(selected)}
                  onRename={newName => handleRename(selected.name, newName)}
                  profile={selected}
                />
              ) : (
                <div className="grid h-full place-items-center px-6 py-12 text-center text-sm text-muted-foreground">
                  <div>
                    <Users className="mx-auto size-6 text-muted-foreground/60" />
                    <p className="mt-3">{zh ? '选择一个配置档案查看详情。' : 'Select a profile to view its details.'}</p>
                  </div>
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      <CreateProfileDialog
        onClose={() => setCreateOpen(false)}
        onCreate={async (name, cloneFromDefault) => handleCreate(name, cloneFromDefault)}
        open={createOpen}
      />

      <Dialog onOpenChange={open => !open && !deleting && setPendingDelete(null)} open={pendingDelete !== null}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{zh ? '删除这个配置档案？' : 'Delete profile?'}</DialogTitle>
            <DialogDescription>
              {pendingDelete ? (
                <>
                  {zh ? (
                    <>
                      这会删除 <span className="font-medium text-foreground">{pendingDelete.name}</span>，并移除它的{' '}
                      <span className="font-mono text-xs">{pendingDelete.path}</span> 目录。此操作无法撤销。
                    </>
                  ) : (
                    <>
                      This will delete <span className="font-medium text-foreground">{pendingDelete.name}</span> and remove
                      its <span className="font-mono text-xs">{pendingDelete.path}</span> directory. This cannot be undone.
                    </>
                  )}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={deleting} onClick={() => setPendingDelete(null)} variant="outline">
              {zh ? '取消' : 'Cancel'}
            </Button>
            <Button disabled={deleting} onClick={() => void handleConfirmDelete()} variant="destructive">
              {deleting ? (zh ? '正在删除...' : 'Deleting...') : zh ? '删除' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function ProfileRow({ active, onSelect, profile }: { active: boolean; onSelect: () => void; profile: ProfileInfo }) {
  const { locale } = useLocale()
  const zh = locale.startsWith('zh')
  return (
    <button
      className={cn(
        'flex w-full flex-col items-start gap-1 rounded-lg px-2.5 py-2 text-left transition-colors',
        active ? 'bg-accent text-foreground' : 'text-foreground/85 hover:bg-accent/60'
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{profile.name}</span>
        {profile.is_default && <span className="text-[0.6rem] text-primary">{zh ? '默认' : 'default'}</span>}
      </span>
      <span className="text-[0.66rem] text-muted-foreground">
        {zh
          ? `${profile.skill_count} 个技能${profile.has_env ? ' · 环境变量' : ''}`
          : `${profile.skill_count} ${profile.skill_count === 1 ? 'skill' : 'skills'}${profile.has_env ? ' · env' : ''}`}
      </span>
    </button>
  )
}

function ProfileDetail({
  onDelete,
  onRename,
  profile
}: {
  onDelete: () => void
  onRename: (newName: string) => Promise<void>
  profile: ProfileInfo
}) {
  const { locale } = useLocale()
  const zh = locale.startsWith('zh')
  const [renameOpen, setRenameOpen] = useState(false)
  const [copying, setCopying] = useState(false)

  const handleCopySetup = useCallback(async () => {
    setCopying(true)

    try {
      const { command } = await getProfileSetupCommand(profile.name)
      await navigator.clipboard.writeText(command)
      notify({ kind: 'success', title: zh ? '启动命令已复制' : 'Setup command copied', message: command })
    } catch (err) {
      notifyError(err, zh ? '复制启动命令失败' : 'Failed to copy setup command')
    } finally {
      setCopying(false)
    }
  }, [profile.name, zh])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold tracking-tight">{profile.name}</h3>
                  {profile.is_default && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
                      {zh ? '默认' : 'Default'}
                    </span>
                  )}
                  {profile.has_env && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                      .env
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[0.7rem] text-muted-foreground" title={profile.path}>
                  {profile.path}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!profile.is_default && (
                  <Button onClick={() => setRenameOpen(true)} size="sm" variant="outline">
                    <Pencil />
                    {zh ? '重命名' : 'Rename'}
                  </Button>
                )}
                <Button disabled={copying} onClick={() => void handleCopySetup()} size="sm" variant="outline">
                  <Terminal />
                  {copying ? (zh ? '正在复制...' : 'Copying...') : zh ? '复制启动命令' : 'Copy setup'}
                </Button>
                {!profile.is_default && (
                  <Button
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={onDelete}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 />
                    {zh ? '删除' : 'Delete'}
                  </Button>
                )}
              </div>
            </div>

            <dl className="grid gap-2 rounded-lg border border-border/40 bg-background/70 px-3 py-3 text-xs sm:grid-cols-2">
              <DetailRow label={zh ? '模型' : 'Model'}>
                {profile.model ? (
                  <>
                    <span className="font-mono">{profile.model}</span>
                    {profile.provider && <span className="text-muted-foreground"> · {profile.provider}</span>}
                  </>
                ) : (
                  <span className="text-muted-foreground">{zh ? '未设置' : 'Not set'}</span>
                )}
              </DetailRow>
              <DetailRow label={zh ? '技能' : 'Skills'}>{profile.skill_count}</DetailRow>
            </dl>
          </header>

          <SoulEditor profileName={profile.name} />
        </div>
      </div>

      <RenameProfileDialog
        currentName={profile.name}
        onClose={() => setRenameOpen(false)}
        onRename={async newName => {
          await onRename(newName)
          setRenameOpen(false)
        }}
        open={renameOpen}
      />
    </div>
  )
}

function DetailRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

function SoulEditor({ profileName }: { profileName: string }) {
  const { locale } = useLocale()
  const zh = locale.startsWith('zh')
  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const requestRef = useRef<string>(profileName)

  useEffect(() => {
    requestRef.current = profileName
    setLoading(true)
    setError(null)
    setContent('')
    setOriginal('')

    void (async () => {
      try {
        const soul = await getProfileSoul(profileName)

        if (requestRef.current === profileName) {
          setContent(soul.content)
          setOriginal(soul.content)
        }
      } catch (err) {
        if (requestRef.current === profileName) {
          setError(err instanceof Error ? err.message : zh ? '加载 SOUL.md 失败' : 'Failed to load SOUL.md')
        }
      } finally {
        if (requestRef.current === profileName) {
          setLoading(false)
        }
      }
    })()
  }, [profileName, zh])

  const dirty = content !== original
  const isEmpty = !content.trim()

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      await updateProfileSoul(profileName, content)
      setOriginal(content)
      notify({ kind: 'success', title: zh ? 'SOUL.md 已保存' : 'SOUL.md saved', message: profileName })
    } catch (err) {
      setError(err instanceof Error ? err.message : zh ? '保存 SOUL.md 失败' : 'Failed to save SOUL.md')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">SOUL.md</h4>
          <p className="text-xs text-muted-foreground">
            {zh ? '这个配置档案内置的人格设定和系统提示词。' : 'The system prompt and persona instructions baked into this profile.'}
          </p>
        </div>
        {dirty && <span className="text-[0.65rem] text-muted-foreground">{zh ? '有未保存修改' : 'Unsaved changes'}</span>}
      </div>

      {loading ? (
        <div className="grid h-44 place-items-center rounded-md border border-border/40 bg-background/60 text-xs text-muted-foreground">
          {zh ? '正在加载 SOUL.md...' : 'Loading SOUL.md...'}
        </div>
      ) : (
        <Textarea
          className="min-h-72 font-mono text-xs leading-5"
          onChange={event => setContent(event.target.value)}
          placeholder={isEmpty ? (zh ? 'SOUL.md 还是空的，可以从这里开始写人格设定...' : 'Empty SOUL.md — start writing the persona...') : undefined}
          value={content}
        />
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button disabled={!dirty || saving || loading} onClick={() => void handleSave()} size="sm">
          <Save />
          {saving ? (zh ? '正在保存...' : 'Saving...') : zh ? '保存 SOUL.md' : 'Save SOUL.md'}
        </Button>
      </div>
    </section>
  )
}

function CreateProfileDialog({
  onClose,
  onCreate,
  open
}: {
  onClose: () => void
  onCreate: (name: string, cloneFromDefault: boolean) => Promise<void>
  open: boolean
}) {
  const { locale } = useLocale()
  const zh = locale.startsWith('zh')
  const [name, setName] = useState('')
  const [cloneFromDefault, setCloneFromDefault] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setName('')
    setCloneFromDefault(true)
    setError(null)
    setSaving(false)
  }, [open])

  const trimmed = name.trim()
  const invalid = trimmed !== '' && !isValidProfileName(trimmed)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!trimmed || invalid) {
      setError(
        invalid
          ? zh
            ? `名称不合法。${PROFILE_NAME_HINT}`
            : `Invalid name. ${PROFILE_NAME_HINT}`
          : zh
            ? '名称不能为空。'
            : 'Name is required.'
      )

      return
    }

    setSaving(true)
    setError(null)

    try {
      await onCreate(trimmed, cloneFromDefault)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog onOpenChange={value => !value && !saving && onClose()} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{zh ? '新建配置档案' : 'New profile'}</DialogTitle>
          <DialogDescription>
            {zh ? '配置档案就是彼此独立的 Hermes 环境：配置、技能和 SOUL.md 都可以分开。' : 'Profiles are independent Hermes environments: separate config, skills, and SOUL.md.'}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium" htmlFor="new-profile-name">
              {zh ? '名称' : 'Name'}
            </label>
            <Input
              aria-invalid={invalid}
              autoFocus
              id="new-profile-name"
              onChange={event => setName(event.target.value)}
              placeholder={zh ? '例如：my-profile' : 'my-profile'}
              value={name}
            />
            <p className={cn('text-[0.66rem] leading-4', invalid ? 'text-destructive' : 'text-muted-foreground')}>
              {PROFILE_NAME_HINT}
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/40 bg-background/50 px-3 py-2 text-sm">
            <input
              checked={cloneFromDefault}
              className="size-4 accent-primary"
              onChange={event => setCloneFromDefault(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="font-medium">{zh ? '从默认配置档案复制' : 'Clone from default'}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {zh ? '从默认配置档案复制配置、技能和 SOUL.md。' : 'Copy config, skills, and SOUL.md from your default profile.'}
              </span>
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button disabled={saving} onClick={onClose} type="button" variant="outline">
              {zh ? '取消' : 'Cancel'}
            </Button>
            <Button disabled={saving || !trimmed || invalid} type="submit">
              {saving ? (zh ? '正在创建...' : 'Creating...') : zh ? '创建配置档案' : 'Create profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameProfileDialog({
  currentName,
  onClose,
  onRename,
  open
}: {
  currentName: string
  onClose: () => void
  onRename: (newName: string) => Promise<void>
  open: boolean
}) {
  const { locale } = useLocale()
  const zh = locale.startsWith('zh')
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setName(currentName)
    setError(null)
    setSaving(false)
  }, [currentName, open])

  const trimmed = name.trim()
  const unchanged = trimmed === currentName
  const invalid = trimmed !== '' && !unchanged && !isValidProfileName(trimmed)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (unchanged) {
      onClose()

      return
    }

    if (!trimmed || invalid) {
      setError(
        invalid
          ? zh
            ? `名称不合法。${PROFILE_NAME_HINT}`
            : `Invalid name. ${PROFILE_NAME_HINT}`
          : zh
            ? '名称不能为空。'
            : 'Name is required.'
      )

      return
    }

    setSaving(true)
    setError(null)

    try {
      await onRename(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : zh ? '重命名配置档案失败' : 'Failed to rename profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog onOpenChange={value => !value && !saving && onClose()} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{zh ? '重命名配置档案' : 'Rename profile'}</DialogTitle>
          <DialogDescription>
            {zh ? (
              <>
                重命名后，会同时更新配置档案目录，以及 <span className="font-mono">~/.local/bin</span> 里的包装脚本。
              </>
            ) : (
              <>
                Renaming updates the profile directory and any wrapper scripts in <span className="font-mono">~/.local/bin</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium" htmlFor="rename-profile-name">
              {zh ? '新名称' : 'New name'}
            </label>
            <Input
              aria-invalid={invalid}
              autoFocus
              id="rename-profile-name"
              onChange={event => setName(event.target.value)}
              value={name}
            />
            <p className={cn('text-[0.66rem] leading-4', invalid ? 'text-destructive' : 'text-muted-foreground')}>
              {PROFILE_NAME_HINT}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button disabled={saving} onClick={onClose} type="button" variant="outline">
              {zh ? '取消' : 'Cancel'}
            </Button>
            <Button disabled={saving || invalid || unchanged} type="submit">
              {saving ? (zh ? '正在重命名...' : 'Renaming...') : zh ? '重命名' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

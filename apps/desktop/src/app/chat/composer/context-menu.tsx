import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useLocale } from '@/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Clipboard, FileText, FolderOpen, type IconComponent, ImageIcon, Link, MessageSquareText } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { GHOST_ICON_BTN } from './controls'
import type { ChatBarState } from './types'

const PROMPT_SNIPPETS: readonly PromptSnippet[] = [
  {
    description: 'Audit the current change for regressions, dropped edge cases, and missing tests.',
    label: 'Code review',
    text: 'Please review this for bugs, regressions, and missing tests.'
  },
  {
    description: 'Outline an approach before touching code so the diff stays focused.',
    label: 'Implementation plan',
    text: 'Please make a concise implementation plan before changing code.'
  },
  {
    description: 'Walk through how the selected code works and link to the key files.',
    label: 'Explain this',
    text: 'Please explain how this works and point me to the key files.'
  }
]

const PROMPT_SNIPPETS_ZH: readonly PromptSnippet[] = [
  {
    description: '检查当前改动有没有回归、漏掉的边界情况和缺失的测试。',
    label: '代码审查',
    text: '请帮我检查这里有没有 bug、回归风险，以及缺少的测试。'
  },
  {
    description: '先列一个做法，再动代码，让改动更聚焦。',
    label: '实现计划',
    text: '请先给我一个简洁的实现计划，再开始改代码。'
  },
  {
    description: '解释选中的代码怎么工作，并指出关键文件。',
    label: '解释这段代码',
    text: '请解释这段代码是怎么工作的，并指出相关的关键文件。'
  }
]

export function ContextMenu({
  state,
  onInsertText,
  onOpenUrlDialog,
  onPasteClipboardImage,
  onPickFiles,
  onPickFolders,
  onPickImages
}: ContextMenuProps) {
  const { locale } = useLocale()
  const zh = locale.startsWith('zh')
  // Prompt snippets used to be a Radix submenu. That submenu didn't open
  // reliably when the parent menu was positioned at the bottom of the
  // window (composer "+" anchor), so we promoted it to a real Dialog —
  // easier to grow with search / descriptions, and no positioning math.
  const [snippetsOpen, setSnippetsOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={state.tools.label}
            className={cn(
              GHOST_ICON_BTN,
              'data-[state=open]:bg-(--chrome-action-hover) data-[state=open]:text-foreground'
            )}
            disabled={!state.tools.enabled}
            size="icon"
            title={state.tools.label}
            type="button"
            variant="ghost"
          >
            <Codicon name="add" size="1rem" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60" side="top" sideOffset={10}>
          <DropdownMenuLabel className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground/85">
            {zh ? '添加内容' : 'Attach'}
          </DropdownMenuLabel>
          <ContextMenuItem disabled={!onPickFiles} icon={FileText} onSelect={onPickFiles}>
            {zh ? '文件…' : 'Files…'}
          </ContextMenuItem>
          <ContextMenuItem disabled={!onPickFolders} icon={FolderOpen} onSelect={onPickFolders}>
            {zh ? '文件夹…' : 'Folder…'}
          </ContextMenuItem>
          <ContextMenuItem disabled={!onPickImages} icon={ImageIcon} onSelect={onPickImages}>
            {zh ? '图片…' : 'Images…'}
          </ContextMenuItem>
          <ContextMenuItem disabled={!onPasteClipboardImage} icon={Clipboard} onSelect={onPasteClipboardImage}>
            {zh ? '粘贴图片' : 'Paste image'}
          </ContextMenuItem>
          <ContextMenuItem icon={Link} onSelect={onOpenUrlDialog}>
            URL…
          </ContextMenuItem>

          <DropdownMenuSeparator />

          <ContextMenuItem icon={MessageSquareText} onSelect={() => setSnippetsOpen(true)}>
            {zh ? '提示词片段…' : 'Prompt snippets…'}
          </ContextMenuItem>

          <DropdownMenuSeparator />

          <div className="px-2 py-1 text-[0.7rem] text-muted-foreground/80">
            {zh ? '提示：输入 ' : 'Tip: type '}
            <kbd className="rounded bg-muted/70 px-1 py-px font-mono text-[0.65rem]">@</kbd>
            {zh ? ' 可以在正文里引用文件。' : ' to reference files inline.'}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <PromptSnippetsDialog
        onInsertText={onInsertText}
        onOpenChange={setSnippetsOpen}
        open={snippetsOpen}
        snippets={zh ? PROMPT_SNIPPETS_ZH : PROMPT_SNIPPETS}
      />
    </>
  )
}

function PromptSnippetsDialog({
  onInsertText,
  onOpenChange,
  open,
  snippets
}: PromptSnippetsDialogProps) {
  const { locale } = useLocale()
  const zh = locale.startsWith('zh')
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md gap-3">
        <DialogHeader>
          <DialogTitle>{zh ? '提示词片段' : 'Prompt snippets'}</DialogTitle>
          <DialogDescription>{zh ? '选一个开场提示词，直接塞进输入框。' : 'Pick a starter prompt to drop into the composer.'}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1">
          {snippets.map(snippet => (
            <li key={snippet.label}>
              <button
                className="group/snippet flex w-full cursor-pointer items-start gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:border-(--ui-stroke-tertiary) hover:bg-(--ui-control-hover-background) focus-visible:border-(--ui-stroke-tertiary) focus-visible:bg-(--ui-control-hover-background) focus-visible:outline-none"
                onClick={() => {
                  onInsertText(snippet.text)
                  onOpenChange(false)
                }}
                type="button"
              >
                <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-(--ui-text-tertiary) group-hover/snippet:text-foreground" />
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-sm font-medium text-foreground">{snippet.label}</span>
                  <span className="text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
                    {snippet.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

export function ContextMenuItem({
  children,
  disabled,
  icon: Icon,
  onSelect
}: ContextMenuItemProps) {
  return (
    <DropdownMenuItem disabled={disabled} onSelect={onSelect}>
      <Icon />
      <span>{children}</span>
    </DropdownMenuItem>
  )
}

interface ContextMenuItemProps {
  children: string
  disabled?: boolean
  icon: IconComponent
  onSelect?: () => void
}

interface ContextMenuProps {
  onInsertText: (text: string) => void
  onOpenUrlDialog: () => void
  onPasteClipboardImage?: () => void
  onPickFiles?: () => void
  onPickFolders?: () => void
  onPickImages?: () => void
  state: ChatBarState
}

interface PromptSnippet {
  description: string
  label: string
  text: string
}

interface PromptSnippetsDialogProps {
  onInsertText: (text: string) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  snippets: readonly PromptSnippet[]
}

# Hermes Desktop 简体中文补丁

这是一个给 `Hermes Agent` Windows 桌面版准备的简体中文补丁仓库。

它不是官方完整源码仓库，也不是整仓 fork；这里放的是：

1. 桌面端汉化后的前端文件
2. 中英切换支持
3. 一键重打脚本
4. 一键更新后重新套用汉化的脚本

适合这类用户：

- 已经装好了 Windows 版 Hermes Desktop
- 想把桌面界面改成简体中文
- 更新桌面版后，希望一键把中文重新打回去

## 仓库内容

- `apps/desktop/src/...`
  只包含这次汉化需要覆盖的桌面端文件
- `scripts/reapply-desktop-zh.ps1`
  把本仓库里的汉化文件同步到 Windows 版 Hermes，并重新打包
- `scripts/update-desktop-zh.ps1`
  先更新 Windows 版 Hermes，再自动重新套用汉化
- `docs/desktop-zh-reapply.md`
  更详细的中文使用说明

## 使用前提

你需要先安装官方 Windows 版 Hermes Desktop。

默认安装目录通常是：

```text
%LOCALAPPDATA%\hermes\hermes-agent
```

## 1. 获取这个补丁仓库

把这个仓库 clone 到任意你方便放的位置。

例如：

```powershell
git clone https://github.com/dgsxjhs/hermes-agent-zh-cn.git
cd hermes-agent-zh-cn
```

## 2. 首次套用汉化

在 PowerShell 里进入这个仓库目录后运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\reapply-desktop-zh.ps1
```

它会自动做这些事：

1. 关闭正在运行的 Hermes
2. 把本仓库里的汉化文件覆盖到 Windows 版 Hermes 安装目录
3. 自动跑类型检查
4. 自动重新打包桌面版
5. 自动重新打开 Hermes

## 3. Hermes 更新后重新打中文

如果官方桌面版更新后界面又变回英文，直接运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update-desktop-zh.ps1
```

它会自动做这些事：

1. 关闭正在运行的 Hermes
2. 暂存 Windows 安装目录里的本地改动
3. 拉取官方最新代码
4. 重新同步本仓库里的汉化文件
5. 自动类型检查、重新打包并重启 Hermes

## 可选参数

只检查汉化文件是否齐全，不打包：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\reapply-desktop-zh.ps1 -CheckOnly
```

只同步文件，不重新打包：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\reapply-desktop-zh.ps1 -SkipBuild
```

打包但不自动打开 Hermes：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\reapply-desktop-zh.ps1 -SkipLaunch
```

## 说明

这不是官方内置中文，而是本地补丁。

所以如果官方后面改了桌面端结构，可能会出现：

1. 脚本还能跑，但有些页面又出现英文
2. 打包时报错

这时通常不是你操作错了，而是上游版本结构变了，需要继续补补丁。

## 关于版权和来源

本仓库只提供桌面端汉化覆盖文件和辅助脚本，用来配合官方项目使用。

Hermes Agent 官方项目：

- https://github.com/NousResearch/hermes-agent

如果你要长期使用，建议同时关注官方仓库更新。

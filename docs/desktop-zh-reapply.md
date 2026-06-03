# Hermes Desktop 汉化重打说明

这个仓库是给已经安装好 Windows 版 Hermes Desktop 的用户用的。

作用很简单：

1. 把这个仓库里的汉化文件同步到 Windows 版 Hermes
2. 自动跑一次类型检查
3. 自动重新打包桌面版
4. 自动重新打开 `Hermes.exe`

## 默认命令

先进入这个仓库目录，再运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\reapply-desktop-zh.ps1
```

## 一键更新命令

如果你想把“更新 Windows 桌面端 + 重新套汉化”合成一步，直接运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update-desktop-zh.ps1
```

## 它默认会处理的路径

- 汉化源码：
  当前这个仓库目录
- Windows 桌面版安装目录：
  `%LOCALAPPDATA%\hermes\hermes-agent`

## 常用模式

只检查文件是否齐全，不打包：

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

## 什么时候需要重跑

通常是这几种情况：

1. 你点了 Hermes 里的更新
2. 你重新装了桌面版
3. 更新后界面又变回英文

## 要注意的事

这不是官方内置中文，而是你本机套上的补丁。

如果官方后续把桌面端结构改得很大，这个脚本可能会出现两类情况：

1. 还能跑，但有些页面重新出现英文
2. 打包时报错

出现这种情况，通常说明上游版本结构变了，需要继续补补丁。

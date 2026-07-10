# Apple MusicPlayer

A local music player for Windows with a Dynamic Island-style floating mini player.

Windows 桌面本地音乐播放器，带灵动岛风格的悬浮迷你播放器。

---

## Overview / 概述

Apple MusicPlayer is an Electron desktop player for local audio files. It has two interfaces: a full-featured main window (`index.html`) and a standalone always-on-top "Dynamic Island" mini player (`electron-notch.html`) that floats at the top of your screen. Built on top of [codecrafter-tl/musicplayer](https://github.com/codecrafter-tl/musicplayer).

基于 Electron 的 Windows 桌面播放器，用来播放本地音频。两个界面：功能完整的主窗口（`index.html`），以及悬浮在屏幕顶部、仿 Apple 灵动岛的独立迷你播放器窗口（`electron-notch.html`）。项目从 [codecrafter-tl/musicplayer](https://github.com/codecrafter-tl/musicplayer) 的基础代码发展而来。

## Features / 功能

- **Dynamic Island notch / 灵动岛悬浮播放器** — 独立无边框、透明、置顶的迷你窗口，居中悬浮在桌面顶部
- **Folder import / 文件夹批量导入** — 通过 `webkitdirectory` 一次性导入整个文件夹的音频、歌词和图片
- **Multiple formats / 多格式音频** — 支持 `.mp3`、`.flac`、`.ogg`；主窗口还支持 `.mp4`、`.webm` 与图片
- **LRC lyrics / LRC 歌词** — 自动匹配并滚动显示 `.lrc` 歌词
- **Metadata / 音频元数据** — 通过 jsmediatags 读取标签与专辑封面，弹窗展示歌曲详情
- **Waveform visualization / 波形可视化** — Web Audio API（AnalyserNode，fftSize 512）驱动波形动画
- **Playback modes / 播放模式** — 正序、倒序、循环、随机
- **Background modes / 背景模式** — 从专辑封面取色块或使用图片作为动态背景
- **Playlist & search / 播放列表与搜索** — 侧栏播放列表，按歌名搜索
- **Volume & speed / 音量与倍速** — 音量条与播放速度控制
- **Keyboard shortcuts / 键盘快捷键** — 见下方使用方法
- **Adaptive layout / 自适应** — 灵动岛窗口宽度约为屏幕一半，分辨率变化时自动居中

<!-- TODO: confirm whether OGG album-art/metadata parsing works for all listed formats in practice. -->

## Tech Stack / 技术栈

| Technology | Version | Role |
|---|---|---|
| [Electron](https://www.electronjs.org/) | ^30.0.0 | 桌面应用框架 / desktop shell (devDep) |
| [electron-builder](https://www.electron.build/) | ^24.13.3 | Windows NSIS 打包 / packaging (devDep) |
| HTML / CSS / JavaScript | — | 界面与逻辑，无框架 / vanilla UI and logic |
| [jsmediatags](https://github.com/aadsm/jsmediatags) | 3.9.5 | 音频元数据解析 / audio metadata (vendored in `libs/`) |
| [Font Awesome Free](https://fontawesome.com/) | 6.7.2 | 图标 / icons (vendored in `libs/`) |
| Web Audio API | — | 波形分析与可视化 / waveform analysis |

内置字体 / Bundled fonts: SF Pro Display/Text, PingFang SC (`libs/*.woff2`)

运行时无 npm 依赖，只有开发期的 electron 和 electron-builder。jsmediatags 与 Font Awesome 以源码形式放在 `libs/` 目录中。

## Project Structure / 项目结构

```
NewAppleMusicPlayer/
├── main.js                # Electron 主进程：灵动岛窗口、全局快捷键、鼠标穿透 IPC
├── preload.js             # contextBridge: notchBridge.setMouseEventsIgnore
├── electron-notch.html    # 灵动岛窗口页面
├── electron-notch.js      # 灵动岛窗口逻辑
├── electron-notch.css     # 灵动岛窗口样式
├── index.html             # 主窗口页面（浏览器直接打开也能用）
├── index.js               # 主窗口逻辑（播放、歌词、波形、播放列表等）
├── index.css              # 主窗口样式
├── settings.html          # 设置页：播放模式与背景模式（localStorage）
├── package.json           # 脚本与 electron-builder 配置
├── LICENSE                # MIT
└── libs/                  # 内置静态资源：Font Awesome、jsmediatags、字体、图标
```

## Getting Started / 快速开始

### Prerequisites / 前置条件

- Node.js v18+
- npm
- Git

<!-- TODO: package.json 未声明 "engines"；v18+ 为建议值，未在代码中强制。 -->

### Install & Run / 安装与运行

```bash
git clone https://github.com/dwgx/NewAppleMusicPlayer.git
cd NewAppleMusicPlayer
npm install
npm start
```

`npm start` 运行 `electron .`，加载灵动岛迷你播放器窗口。

主窗口 `index.html` 是纯前端页面，也可以直接在浏览器中双击打开使用。当前 Electron 主进程默认只加载灵动岛窗口。

<!-- TODO: confirm the intended entry point for the full main-window experience under Electron. -->

### Build (Windows) / 打包

```bash
npm run package   # electron-builder --win --x64 -> dist/
```

输出 Windows x64 NSIS 安装包（`appId: apple.dwgx.musicplayer`，图标 `libs/favicon-32.ico`）。

## Usage / 使用方法

1. 点击主界面的音乐图标（或灵动岛专辑封面）打开文件选择器，选一个文件夹或音频文件
2. 支持导入：`.mp3`、`.flac`、`.ogg`、`.lrc`、图片；主窗口还支持 `.mp4`、`.webm`
3. 用进度条、音量条、倍速条控制播放，或用键盘快捷键

### Keyboard Shortcuts / 键盘快捷键

| Key / 按键 | Action / 动作 |
|---|---|
| `Space` | 播放 / 暂停 |
| `→` / `←` | 快进 / 快退 5 秒 |
| `Ctrl + →` / `Ctrl + ←` | 下一首 / 上一首 |
| `Tab` | 显示 / 隐藏播放列表 |
| `Ctrl/Cmd + Q` | 退出应用 (global) |

## Configuration / 配置

设置页 `settings.html` 将选项写入 `localStorage`，主窗口通过 `postMessage` 接收更新。

| Key | Values | Default |
|---|---|---|
| `playbackMode` | `sequential` / `reverse` / `loop` / `random` | `loop` |
| `backgroundMode` | `color` / `image` | `color` |
| `volume` | 0–100 | — |

IPC：渲染进程通过 `preload.js` 暴露的 `notchBridge.setMouseEventsIgnore(ignore)` 调用 `toggle-mouse-events`，控制灵动岛的鼠标穿透。

## Demos / 演示

- Bilibili — [完整展示](https://www.bilibili.com/video/BV1mBRSYaEwx) · [灵动岛演示](https://www.bilibili.com/video/BV1HYZUYZEgb)
- YouTube — [仿 Apple Music 本地播放器](https://www.youtube.com/watch?v=hK28IQMAqKU)

## Status / 状态

个人项目，仍在完善中。后续计划：播放列表拖拽排序与保存、主题切换（浅色/深色/自定义）、在线歌词抓取、网易云音乐集成、大播放列表性能优化。

Personal project, work in progress. Planned: drag-to-reorder playlists, light/dark/custom themes, online lyrics fetching, NetEase Cloud Music integration, performance tuning for large playlists.

## License / 许可证

[MIT](LICENSE) — Copyright (c) 2025 帝王尬笑

## Acknowledgements / 致谢

- 基础代码来自 [codecrafter-tl/musicplayer](https://github.com/codecrafter-tl/musicplayer)
- 内置第三方资源：[Font Awesome Free](https://fontawesome.com/)、[jsmediatags](https://github.com/aadsm/jsmediatags)，许可证随各自目录保留

# Apple MusicPlayer 🎵✨

#### 演示视频 🎥
哔哩哔哩
[AppleMusicPlayer 完整展示](https://www.bilibili.com/video/BV1mBRSYaEwx?vd_source=db744a4d7ef94ed65203fb0f2b5fb021)
[AppleMusicPlayer 灵动岛 幼稚园杀手版展示](https://www.bilibili.com/video/BV1HYZUYZEgb?vd_source=db744a4d7ef94ed65203fb0f2b5fb021)  

Youtube
[仿AppleMusicPlayer本地音乐播放器设计](https://www.youtube.com/watch?v=hK28IQMAqKU)

灵动岛的独立演示 展示幼稚园杀手专辑 看它如何在桌面活动
一览播放器的全貌 从主界面到灵动岛 体验音乐与设计的完美融合

## 项目背景 🌟
本项目由 https://github.com/codecrafter-tl/musicplayer 项目作为地基代码开发


再哔哩哔哩看到了实用又好看的本地音乐播放器 因为迷恋幼稚园杀手 同时享受视觉上的愉悦 Apple MusicPlayer 就是这个梦想的结晶 它不仅支持常见的音频格式 MP3 FLAC OGG 还能加载 LRC 歌词 展示专辑封面 甚至通过波形可视化让音乐跳动起来 灵动岛的加入更是锦上添花 让桌面体验变得生动而有趣

无论是深夜 coding 的背景音乐 还是周末放松时的专属播放器 它都能完美胜任 现在我迫不及待地把它分享到 GitHub 与大家一起探索和完善

还有 我用新苹果🍎
## 核心亮点 ✨

灵动岛 Notch 体验  
一个高仿 Apple 移动端 悬浮在屏幕顶部的迷你播放器 鼠标悬停时展开 展示封面 歌词 进度和控制按钮 宛如 macOS 的灵动岛 优雅又实用

动态波形可视化  
音频波形随着节奏跳动 专辑封面色彩融入波形渐变 让每一首歌都变成一场视觉盛宴

歌词与元数据支持  
自动匹配 LRC 歌词 实时滚动显示 借助 jsmediatags 读取音频元数据 呈现歌曲信息

自适应屏幕  
无论什么分辨率 窗口和灵动岛始终居中靠上 完美适配你的桌面

播放模式多样  
支持顺序 循环 随机和倒序播放 满足不同心情下的听歌需求

自定义背景  
从专辑封面提取色彩 生成动态模糊背景 沉浸感拉满

文件夹批量加载  
一键导入文件夹 支持音频 歌词和图片文件 自动整理播放列表

## 技术栈 🛠️

Electron 跨平台桌面应用框架 带来原生体验  
HTML CSS JavaScript 构建直观且美观的界面  
FontAwesome 提供优雅的图标支持  
jsmediatags 解析音频元数据  
Web Audio API 实现波形可视化和音频分析

## 快速上手 🚀

下载后只需双击 indexhtml 选择你准备好的文件夹 就能开始享受音乐 想深入开发或打包 请继续以下步骤

### 前置条件
Nodejs 建议 v18 或更高版本  
Git

### 安装步骤
1 克隆项目到本地
```bash

git clone https://githubcom/dwgx/AppleMusicPlayergit
```
```bash

cd AppleMusicPlayer
```
2 安装依赖
```bash

npm install
```
3 启动独立灵动岛
```bash

npm start
```
4 打包成可执行文件 Windows

```bash
npm run package
```
打包结果会出现在 dist 文件夹中

### 使用方法
#### 点击灵动岛的专辑封面或主界面的音乐图标 选择文件夹或单个音频文件
#### 支持的文件类型 mp3 flac ogg lrc 图片文件
#### 用鼠标拖动进度条 音量条 或用键盘快捷键 空格播放 暂停 左右箭头快进 快退 控制播放

```
项目结构 📂
AppleMusicPlayer/
├── libs # 静态资源 字体 FontAwesome jsmediatags等
├── dist # 打包输出目录
├── indexhtml # 主窗口页面
├── indexjs # 主窗口逻辑
├── indexcss # 主窗口样式
├── electron-notchhtml # 灵动岛窗口页面
├── electron-notchjs # 灵动岛逻辑
├── electron-notchcss # 灵动岛样式
├── mainjs # Electron 主进程
├── packagejson # 项目配置和依赖
└── READMEmd # 你正在读的文件
```
# 未来计划 🌈
#### 播放列表管理 添加拖拽排序 保存播放列表功能
#### 主题切换 支持浅色 深色模式 甚至自定义主题
#### 在线歌词 从网络抓取歌词 解决无本地 LRC 的遗憾
#### 在线音乐 集成网易云音乐登录 畅享云端曲库
#### 性能优化 减少内存占用 提升大规模播放列表的流畅度
```
贡献指南 🤝
喜欢这个项目 欢迎加入改进的行列
Fork 项目 提交 Pull Request
有 Bug 或建议 请在 Issues 中告诉我
一起让它变得更好吧
```

# 致谢
感谢 Electron FontAwesome 和 jsmediatags 的开发者 给了我实现梦想的工具 也要感谢你 是的 就是你 愿意体验和支持这个项目

## License
#### 本项目采用 MIT [LICENSE](LICENSE) 自由使用 修改和分享 但请保留原作者信息
Apple MusicPlayer 


<div align="center">

<p align="center">
  <img src="./assets/logo.png" alt="reSpeaker Console" width="120" />
</p>

# reSpeaker Console

[English](./README.md) | 简体中文

[![Latest Release](https://img.shields.io/github/v/release/respeaker/respeaker-console?label=Latest%20Release)](https://github.com/respeaker/respeaker-console/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](https://github.com/respeaker/respeaker-console/releases/latest)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

reSpeaker XVF3800 跨平台桌面控制应用，基于 Tauri v2、React 19 和 TypeScript 构建。

</div>

## 简介

reSpeaker Console 是用于配置、监控和诊断 reSpeaker XVF3800 的跨平台桌面应用，将 USB 设备连接、实时状态、参数管理、固件刷写和诊断导出等常用工作流整合到可视化界面中。

## 预览

<table>
  <tr>
    <th>设备连接</th>
    <th>实时监控</th>
    <th>音频控制</th>
  </tr>
  <tr>
    <td><img src="./assets/device.png" width="260" alt="设备连接" /></td>
    <td><img src="./assets/monitor.png" width="260" alt="实时监控" /></td>
    <td><img src="./assets/audio.png" width="260" alt="音频控制" /></td>
  </tr>
  <tr>
    <th>参数配置</th>
    <th>LED 控制</th>
    <th>日志</th>
  </tr>
  <tr>
    <td><img src="./assets/config.png" width="260" alt="参数配置" /></td>
    <td><img src="./assets/led.png" width="260" alt="LED 控制" /></td>
    <td><img src="./assets/logs.png" width="260" alt="日志" /></td>
  </tr>
</table>

## 功能

- USB 设备扫描、选择、连接、断开与重启
- DOA 罗盘可视化、VAD、RT60、AEC 收敛状态、波束能量等实时监控
- 麦克风增益、参考增益、AGC、回声相关开关等音频链路控制
- LED 环形灯效、亮度、速度和颜色调节
- 参数目录搜索、读取、写入、导出、导入、保存到 Flash、恢复默认配置
- 通过 DFU 刷写固件（Windows 已内置 `dfu-util`，macOS/Linux 需单独安装）
- 应用内事件日志筛选与导出
- 托盘菜单与全局快捷键唤起主窗口
- 单实例锁定，重复启动时聚焦已有窗口
- 基于 GitHub Releases 的内置更新流程
- 中英文界面
- 明暗主题支持

## 下载安装

前往 [Releases](https://github.com/respeaker/respeaker-console/releases/latest) 页面下载对应平台的安装包：

| 平台    | 架构          | 安装包类型               |
| ------- | ------------- | ------------------------ |
| Windows | x64           | `.msi` / `.exe`      |
| macOS   | Apple Silicon | `.dmg` (aarch64)       |
| macOS   | Intel         | `.dmg` (x86_64)        |
| Linux   | x64           | `.deb` / `.AppImage` |

### Windows：USB 驱动配置

首次使用前需通过 [Zadig](https://zadig.akeo.ie/) 为设备安装 WinUSB 驱动：

1. 下载并运行 [Zadig](https://zadig.akeo.ie/)
2. 菜单选择 `Options > List All Devices`
3. 在设备列表中选择 `reSpeaker 3800` 或 `reSpeaker XVF3800 4-Mic Array`
4. 驱动选择 **WinUSB**，点击 **Install Driver**
5. 重新插拔设备后，运行 `dfu-util -l` 确认设备被识别

> `dfu-util.exe` 已随应用一同打包，无需单独安装。

### macOS：安装 dfu-util

使用固件刷写功能前需安装 `dfu-util`：

```bash
brew install dfu-util
```

### Linux：安装 dfu-util 并配置 USB 权限

```bash
sudo apt install dfu-util
```

访问 USB 设备还需配置 udev 规则。创建 `/etc/udev/rules.d/99-respeaker.rules`：

```
SUBSYSTEM=="usb", ATTRS{idVendor}=="2886", MODE="0666", GROUP="plugdev"
```

之后执行以下命令并重新插拔设备：

```bash
sudo udevadm control --reload-rules && sudo udevadm trigger
```

## 从源码构建

### 环境要求

- Node.js >= 18
- pnpm >= 9
- Rust >= 1.70

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm tauri:dev
```

### 构建发布

```bash
pnpm tauri:build
```

## 技术栈

| 层级     | 技术                        |
| -------- | --------------------------- |
| 桌面框架 | Tauri v2                    |
| 前端框架 | React 19 + TypeScript       |
| 构建工具 | Vite                        |
| UI 组件  | shadcn/ui                   |
| 样式方案 | Tailwind CSS v4             |
| 国际化   | i18next                     |
| 原生后端 | Rust + Tauri plugins + rusb |

## License

MIT

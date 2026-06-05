<div align="center">

# reSpeaker Console

[English](./README.md) | 简体中文

[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

一款面向 reSpeaker XVF3800 设备的桌面控制应用，基于 Tauri v2、React 19 和 TypeScript 构建。

</div>

## 预览

![应用截图](./screenshots/app.png)

## 简介

reSpeaker Console 是一个通过 USB 对 reSpeaker XVF3800 进行配置、监控和诊断的跨平台桌面应用。它把设备命令面封装成可视化控制界面，方便研发、测试和现场支持人员在不依赖零散脚本的情况下完成常见操作。

当前应用采用单设备连接模型，围绕连接设备、查看实时状态、调整参数、管理持久化配置、导出诊断信息和执行更新等实际工作流进行设计。

## 功能

- USB 设备扫描、选择、连接、断开与重启
- DOA、VAD、RT60、AEC 收敛状态、波束能量等实时监控
- 麦克风增益、参考增益、AGC、回声相关开关等音频链路控制
- LED 环形灯效、亮度、速度和颜色调节
- 参数目录搜索、读取、写入、导出、导入、保存到 Flash、恢复默认配置
- 应用内事件日志筛选与导出
- 托盘菜单与全局快捷键唤起主窗口
- 基于 GitHub Releases 的内置更新流程
- 中英文界面
- 明暗主题支持

## 技术栈

- **桌面框架**: [Tauri v2](https://tauri.app/)
- **前端框架**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vite.dev/)
- **UI 组件**: [shadcn/ui](https://ui.shadcn.com/)
- **样式方案**: [Tailwind CSS v4](https://tailwindcss.com/)
- **国际化**: [i18next](https://www.i18next.com/)
- **原生后端**: Rust + Tauri plugins + `rusb`

## 开始使用

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

## License

MIT

# AltTab - Chrome Tab Switcher

像 Windows Alt+Tab 一样快速切换 Chrome 标签页。

Switch between Chrome tabs just like Windows Alt+Tab.

## 安装 / Installation

### 方式一：Chrome 应用商店（推荐） / Chrome Web Store (Recommended)

> 暂未上架，敬请期待。Coming soon.

### 方式二：下载压缩包安装 / Install from Zip

1. 下载最新 [Releases](https://github.com/Chinjure/altab/releases) 中的 `altab.zip`
2. 解压到任意目录
3. 打开 Chrome，进入 `chrome://extensions/`
4. 开启右上角「开发者模式」
5. 点击「加载已解压的扩展程序」，选择解压后的目录

---

1. Download the latest `altab.zip` from [Releases](https://github.com/Chinjure/altab/releases)
2. Extract to any folder
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" and select the extracted folder

### 方式三：开发者安装 / Developer Install

```bash
git clone https://github.com/Chinjure/altab.git
```

Then load the cloned directory as an unpacked extension in `chrome://extensions/`.

## 快捷键 / Shortcuts

| 操作 | 快捷键 |
|------|--------|
| 快速切换到上一个标签 | `Alt+Q` 轻按一次（< 0.2s 松键） |
| 打开选择器 | `Alt+Q` 按住不放或连按两次 |
| 下一个标签 | `Tab` / `→` / `↓` |
| 上一个标签 | `Shift+Tab` / `←` / `↑` |
| 确认跳转 | `Enter` 或松开 `Alt` |
| 取消 | `Esc` 或点击遮罩 |
| 跳到首个/末尾 | `Home` / `End` |

| Action | Shortcut |
|--------|----------|
| Quick-switch to previous tab | `Alt+Q` tap once (< 0.2s release) |
| Open tab switcher | `Alt+Q` hold or double-tap |
| Next tab | `Tab` / `→` / `↓` |
| Previous tab | `Shift+Tab` / `←` / `↑` |
| Confirm & switch | `Enter` or release `Alt` |
| Cancel | `Esc` or click backdrop |
| Jump to first/last | `Home` / `End` |

### 用法说明 / How to Use

- **快速切换 / Quick-switch**：按住 `Alt`，轻点一次 `Q`，在 0.2 秒内松手，直接跳回上一个打开过的标签页。如果当前没有上一个标签（首次打开浏览器），则无效。
- **选择器模式 / Switcher**：按住 `Alt`，连按两次 `Q`（或按住 `Q` 超过 0.2 秒），弹出全屏选择器，继续按 `Q` 或方向键浏览标签，松手即跳转。

快捷键可在 `chrome://extensions/shortcuts` 自定义。

Shortcuts can be customized at `chrome://extensions/shortcuts`.

# Conda Workspace Environment for DeepSeek Harness

[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-DSH-111827)](https://github.com/deepseek-ai/deepseek-harness)
[![DSH plugin](https://img.shields.io/badge/DSH-plugin-2563eb)](https://github.com/topics/dsh-plugin)
[![Conda](https://img.shields.io/badge/environment-Conda-44a833)](https://docs.conda.io/)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 工作区选择并持久化 Conda 虚拟环境。插件直接集成到原生对话输入栏，不启动独立网页。

![Conda Workspace Environment 演示](./1.gif)

## 解决什么问题

同一台开发机通常存在多个 Conda 环境，而不同项目依赖的 Python、解释器和包版本并不相同。这个插件提供一个与 Harness 原生控件一致的环境选择器，让每个工作区明确记录自己应使用的 Conda prefix。

- 自动读取 `conda env list --json`。
- 在当前工作区的对话输入栏选择环境。
- 每个工作区独立保存选择，不会互相覆盖。
- 支持明暗主题，按钮样式与 Harness 原生控件一致。
- 向 Agent 提供环境查询和选择工具。
- 只接受 Harness 已注册的工作区路径。

## 环境要求

- DeepSeek Harness `0.1.0-rc.6` 或兼容的 `0.1.x` 版本
- Node.js 22 或更高版本
- 已安装 Conda、Miniconda 或 Anaconda
- 启动 Harness 的进程可以执行 `conda`

先确认 Conda 对 Harness 所在的 shell 可见：

```bash
conda env list --json
```

## 安装

### 从 GitHub 安装

在 DeepSeek Harness 项目目录执行：

```bash
cd ~/deepseek-harness
pnpm dsh plugin --profile web add -w github:Mshir0/dsh-conda-workspace-env
pnpm dsh --profile web --dump-config
pnpm dsh web
```

如果使用独立的 DSH CLI：

```bash
npx -y @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add -w github:Mshir0/dsh-conda-workspace-env
npx -y @deepseek-ai/dsh@0.1.0-rc.6 --profile web --dump-config
npx -y @deepseek-ai/dsh@0.1.0-rc.6 web
```

安装或升级后需要重启 Harness。浏览器仍显示旧界面时，按 `Ctrl+Shift+R` 强制刷新。

### 本地源码安装

```bash
git clone https://github.com/Mshir0/dsh-conda-workspace-env.git ~/dsh-conda-workspace-env
cd ~/deepseek-harness
pnpm dsh plugin --profile web add -w ~/dsh-conda-workspace-env
pnpm dsh web
```

修改插件源码后，重新执行 `plugin ... add -w` 并重启 Harness。

## 使用方法

1. 打开 Harness Web 界面并进入一个带工作区的会话。
2. 在底部输入栏找到“环境”按钮。
3. 打开菜单，选择当前项目对应的 Conda 环境。
4. 选择结果立即保存到当前工作区。
5. 切换工作区时，插件会读取该工作区自己的选择。

选择结果保存在：

```text
<workspace>/.context/conda-environment.json
```

文件内容示例：

```json
{
  "workspace": "/home/user/project",
  "environment": {
    "name": "project-env",
    "prefix": "/home/user/miniconda3/envs/project-env",
    "source": "conda"
  },
  "updatedAt": "2026-08-19T10:00:00.000Z"
}
```

菜单中的“未选择”会清除当前工作区的环境记录。

## Agent 工具

插件注册两个 DeepSeek Harness 工具：

| 工具 | 用途 |
| --- | --- |
| `conda_list_environments` | 列出 Harness 主机可见的 Conda 环境及其 prefix |
| `conda_workspace_environment` | 读取或保存当前工作区选择的环境 |

可以让 Agent 验证当前选择：

```text
调用 conda_workspace_environment 读取当前工作区选择的 Conda 环境，
然后只报告环境名称和解释器 prefix，不修改任何文件。
```

## 当前行为边界

当前版本负责“发现、选择和持久化”环境，不会执行 `conda activate`，也不会自动修改 Harness 内所有命令的 `PATH` 或 Python 解释器。

需要运行指定环境中的 Python 时，应使用保存的 prefix 构造明确路径，例如：

```bash
/home/user/miniconda3/envs/project-env/bin/python --version
```

这可以避免非交互 shell 中 `conda activate` 不生效，也能准确验证 Agent 使用了哪个解释器。

## 故障排查

### 输入栏没有“环境”按钮

确认配置中存在 `conda-workspace-env`，重启 Harness 后强制刷新浏览器：

```bash
pnpm dsh --profile web --dump-config
pnpm dsh web
```

然后按 `Ctrl+Shift+R`。

### 显示“环境错误”

在启动 Harness 的同一个 shell 中执行：

```bash
command -v conda
conda env list --json
```

如果命令不可用，需要先初始化 Conda，或者让启动 Harness 的 shell 能找到 Conda 可执行文件。

### 选择没有保存

确认当前会话已经关联工作区，并检查 Harness 对以下目录是否具有写权限：

```text
<workspace>/.context/
```

## 更新

```bash
cd ~/deepseek-harness
pnpm dsh plugin --profile web add -w github:Mshir0/dsh-conda-workspace-env
pnpm dsh web
```

重启后按 `Ctrl+Shift+R`，确保客户端加载最新 bundle。

## 卸载

```bash
cd ~/deepseek-harness
pnpm dsh plugin --profile web remove -w dsh-conda-workspace-env
pnpm dsh web
```

卸载插件不会删除各工作区已有的 `.context/conda-environment.json`；不再需要时可由用户自行移除该文件。

## License

MIT

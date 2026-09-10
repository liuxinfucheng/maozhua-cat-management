# 猫爪猫咪管理后台

仅面向 Windows 发布的本地离线猫咪信息管理工具。项目基于 React、TypeScript、Ant Design 和 Tauri 2。

## 本地启动

只调试前端界面：

```bash
npm install
npm run dev
```

启动 Tauri 桌面窗口（需先安装 Rust）：

```bash
npm run tauri dev
```

## 生产构建

```bash
npm run build
```

Windows 便携版可执行文件应在 Windows 环境或 Windows CI 中构建：

```bash
npm run tauri build
```

构建完成后可以直接分发 `.exe`。首次运行时，程序会在 `.exe` 所在目录自动创建 `本地数据` 文件夹。

## GitHub 云端构建 Windows EXE

项目包含 `.github/workflows/build-windows.yml`，上传到 GitHub 后可手动构建：

1. 打开仓库的 `Actions` 页面。
2. 选择 `Build Windows x64 EXE`。
3. 点击 `Run workflow`。
4. 构建完成后，在本次运行页面底部下载 `cat-paw-management-windows-x64`。

下载的压缩包内包含可直接运行的 `cat-paw-cat-management.exe`。云端构建产物保留 7 天。

## 数据目录

Tauri 桌面模式使用 SQLite，数据库位于 `本地数据/业务数据/猫爪数据.db`。猫咪照片作为独立文件保存在 `本地数据/猫咪照片/`，数据库中只记录相对路径。

普通浏览器调试模式无法直接使用原生 SQLite，仍使用 `localStorage` 作为临时数据存储；Windows 桌面程序才会实际创建和读写 SQLite 文件。

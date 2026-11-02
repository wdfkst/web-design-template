# 后台预览本地素材

- `soft.png`：用户已确认的柔和立体 AI 示例，复制自本工作树 `.vudt/style-preview-gen/images/coffee-soft.png`。
- `warm.png`：用户已确认的温润自然 AI 示例，复制自同目录 `coffee-warm.png`。
- `mist.png`：用户已确认的雾色微光 AI 示例，复制自同目录 `coffee-mist.png`。
- `porcelain.svg` / `aurora.svg`：本任务编写的静态咖啡器具示意，**不是 AI 成图**。预览正文和 manifest 的 `assetKind: illustration` 都标识该区别。

前三项仅复用已获准用于本项目风格预览的已有生成结果，不新增图片请求。这里只收录上述五项素材，不复制配置、凭证、生成脚本或整个 `.vudt` 目录。

构建通过本地 ImageProvider 读取素材，并使用现有 Sharp processor 转为侧车尺寸的 PNG；不从网络获取素材。所有业务记录与数字为本地演示数据，非真实商户记录。

# Claude Code 协作规则

## 上下文管理

- 读取超过 200 行的文件必须用 `sed -n 'start,endp'` 或 Read 的 offset/limit 分段读取
- 禁止直接 `cat` 大文件
- 命令输出可能超过 100 行时，必须加 `| head -n 100` 或 `| tail -n 100`，或重定向到文件后 `grep`
- 不要粘贴完整日志，先用 `grep -n` 定位，再读周围 20 行
- 每次只处理一个子任务，完成后总结并 `/clear`

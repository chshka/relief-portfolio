# 验收与部署

## 本地生成与启动

Python3运行脚手架；Node.js运行本地服务；网页无需npm依赖安装或编译。Blender仅建模阶段使用，页面运行不需要它。

```powershell
python -X utf8 '<技能目录>/scripts/scaffold.py' --mode single --profile './profile.json' --out './my-site'
cd my-site
npm run dev
```

打开 http://127.0.0.1:4173/ 。端口占用可在PowerShell设置 `$env:PORT='4182'` 后启动。不能双击HTML代替HTTP服务器。

## 行为验证

- 所有引用资源可访问、模型实际加载，shader编译及GL无错误。检查首屏与最后一幅，不能只检查首页截图。
- 桌面滚轮产生scrollX；文字矩形与面板偏移一致。手机真实touch事件产生scrollY，页面不横向溢出，外框不裁切。
- 自动源与手动源能并存；纯自动期间文字手动流场保持中性，链接和选择可用。
- gallery在静止、半隆起、完全隆起、回落四个阶段截图比较。材质一致，阴影随高度改变，无显现遮罩硬边。single则验显现遮罩，不套用gallery标准。
- 暂停/减少动态效果恢复静态模型和DOM文字；隐藏标签不继续占用动画帧。
- 阻塞一个首屏模型：加载页退出、提示降级、正文不保持inert。检查后续模型失败不破坏前面内容。
- 模拟WebGL上下文丢失恢复。旋转手机、缩小桌面高度、长文案、增加作品时确认内容仍可访问。
- 用原生视觉检查截图，自动断言不能代替观感。真实手机未测试必须明说，不承诺60fps。

## 两种公开访问路线

Cloudflare Workers静态资源：把dist交给托管服务，不需要自己租VPS。原参考站的workers.dev只证明Cloudflare入口，无法据此知道私有源码、CI或实际上传方式。

wrangler.jsonc 示例：
```json
{"name":"my-relief-site","compatibility_date":"2026-10-17","assets":{"directory":"./dist"}}
```
用户明确要求发布后才执行 `npx wrangler login` 与 `npx wrangler deploy`。发布前核查账号、项目名、当前资源大小/数量限制，发布后实测URL、手机加载、所有GLB和图片。费用/额度按当时官方文档确认。

自有域名+VPS：注册域名 → 创建服务器 → 使用Nginx等静态服务托管dist → 将域名DNS指向服务器 → 配置HTTPS → 检查防火墙/缓存/资源压缩 → 维护更新备份。域名是地址、服务器保存和发送文件，DNS负责关联，TLS提供HTTPS。当前网站没有数据库后端，不需要为了作品展示引入数据库。

也可以只买域名绑定静态托管，不必租服务器。选择前核对受众网络可达性和地区要求。技能不自动购买、修改DNS或发布。

官方参考（制作教程时核查；执行部署时再次核查）：
- https://developers.cloudflare.com/workers/static-assets/get-started/
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/

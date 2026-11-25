# 轻松熊 · 甜梦漫跑

一个温柔可爱的三维三道跑酷游戏，基于 [Subway Rush](https://github.com/AmineDehane/subway-surfers)（MIT）改编。

在线游玩：https://3o0o0opps-collab.github.io/rilakkuma-game/sweet-run/

## 玩法

- 左右方向键 / A D：换道；手机左右滑动。
- 上方向键 / W / 空格：跳跃；手机向上滑动。
- 下方向键 / S：翻滚或快速下落；手机向下滑动。
- P / Esc：暂停，空格也可继续。
- 跳过野餐篮，滚过彩旗架，绕开甜品车，收集布丁。
- 距离逐渐增加时速度缓慢提升。最高距离保存在当前浏览器，不需要登录。

## 本地运行

需要 Node.js 22 或更新版本，无需安装依赖：

```sh
node serve.mjs
```

访问 http://127.0.0.1:4187 。也可以用任意静态 HTTP 服务器。不要双击 HTML；浏览器的 ES 模块需要通过 HTTP 加载。

## 验证

```sh
node --test tests/rules.test.mjs
node --check src/main.js
node --check src/world.js
node --check src/audio.js
```

自动检查包含一万组障碍布局的可通行性、高速碰撞、跳跃净空、翻滚、换道时机和不可用的本地存储。浏览器测试记录见 VERIFICATION.md。

## 发布

所有运行文件均为静态资源，三维引擎也在仓库内，无需 CDN、构建或服务器。
将本目录部署到 GitHub Pages 即可。本次放在现有 rilakkuma-game 仓库的 sweet-run 子目录，与根目录的合成游戏分别访问。

## 素材与来源

- 菜单中的轻松熊、小白熊、小黄鸡原图来自 San-X 官方角色页面，地址见 assets/sources.json。
- 游戏中的三维轻松熊是按官方设定制作的程序模型，包含耳内颜色、奶油色口鼻与肚皮、尾巴和背后拉链；不是 San-X 官方发行的三维模型。
- 场景、甜品、障碍和界面在 src/world.js 与 src/style.css 中制作。音乐和音效由 Web Audio 合成。
- 跑酷机制参考并改编 Subway Rush，原作者 Mohamed Amine Dehane，保留其 MIT 许可证。
- Three.js r187，MIT；vendor/three/LICENSE 为引擎许可证。

这是个人同人游戏，不代表或隶属于 San-X。角色属于 SAN-X；代码许可证不授予角色素材的再授权。

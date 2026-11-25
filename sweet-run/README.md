# 轻松熊 · 甜梦漫跑

以三维场景搭配手绘角色的三道跑酷游戏，改编自 [Subway Rush](https://github.com/AmineDehane/subway-surfers)（MIT）。

[在线游玩](https://3o0o0opps-collab.github.io/rilakkuma-game/sweet-run/)

## 玩法

- 左右方向键或 A、D 换道。手机左右滑动。
- ↑、W 或空格跳跃。手机向上滑动。
- ↓ 或 S 贴地滑行。手机向下滑动。在空中也可快速下落。
- P 或 Esc 暂停。最高距离保存在当前浏览器。

从甜品小镇出发，经过樱花野餐道、蜂蜜河畔和灯笼夜市。跟着布丁寻找路线。野餐篮、横木、断桥需要跳过，低梁和灯笼帘可以从下方穿过。橙色路面标记提示横移甜品车即将占据的车道。

## 本地运行

需要 Node.js 22 或更新版本。运行 `node serve.mjs` 后打开 `http://127.0.0.1:4187`。也可以用任意静态 HTTP 服务器。

`node --test tests/rules.test.mjs` 验证障碍布局、连续动作的可通行性、场景切换和历史最高分。部署源目录为 GitHub Pages 仓库的 `sweet-run/`。

## 素材与来源

- 游戏内站姿、挥手和侧躺原图来自[轻松熊动画官网](https://rilakkuma-anime.com/)。场景为三维，游戏用这三张手绘角色图表现跑步、跳跃和滑行。
- 菜单里的角色贴图来自 [San-X 官方角色网站](https://www.san-x.co.jp/ja/characters/rilakkuma/)。图片的原始地址在 `assets/sources.json`。
- 场景、障碍、布丁和界面为本项目制作。音乐和音效由 Web Audio 合成。
- 保留 Subway Rush 原作者 Mohamed Amine Dehane 和 Three.js 的 MIT 许可证。

这是个人同人游戏。轻松熊角色和图片权利归 SAN-X 及相关权利方，代码许可证仅适用于相应代码。

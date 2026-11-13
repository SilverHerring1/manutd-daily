# 图片对照表

图片是我从各家页面自动抓的，看着不对就换。换法只有一条：

1. 把新图放进 `media/`（文件名随意，`.jpg` / `.webp` / `.png` 都行）；
2. 打开对应那期的 `data/*.json`，把 `hero.src` 或该条新闻的 `image.src` / `images[].src` 改成新文件名；
3. 顺手把 `width` / `height` 改成新图的真实像素（不改也能显示，但页面会有一下抖动）。

## 当前用了哪些图

| 文件 | 画的是什么 | 用在哪 |
|---|---|---|
| `spurs.jpg` | 曼联对热刺的比赛画面 | 10-11 早报头图 |
| `spurs2.jpg` | 同场另一角度 | 10-11 条目配图 |
| `atletico.jpg` | 马竞客场 | 10-14 头图 |
| `atletico2.jpg` | 马竞客场竖图 | 10-14 条目配图 |
| `leeds.jpg` | 利兹客场 | 10-19 头图 |
| `leeds2.jpg` | 姆贝乌莫捂脸竖图 | 10-19 条目配图 |
| `como.jpg` | 科莫客场 | 10-22 头图 |
| `como2.jpg` | 老特拉福德外球迷合影（"WE'VE SEEN IT ALL" 横幅） | 10-22 条目配图 |
| `bournemouth.jpg` | 伯恩茅斯主场 | 10-26 头图 |
| `bournemouth2.jpg` | 同场 | 10-26 条目配图 |
| `chelsea.jpg` | 切尔西客场 | 11-01 头图 |
| `chelsea2.jpg` | 同场 | 11-01 条目配图 |
| `roma.jpg` | 库尼亚庆祝逆转 | 11-04 头图 |
| `roma2.jpg` | 库尼亚竖图 | 11-04 组图 |
| `bruno.jpg` | B 费与裁判 | 11-04 组图 |
| `protest.webp` | 斯特雷特福德看台，绿金气球 + "NOT THE LIKES" 横幅 | 11-04 抗议那条 |
| `villa.jpg` | 多古绝平后倒地 | 11-09 头图 |
| `villa2.jpg` | 姆贝乌莫 | 11-09 组图 |
| `fans.jpg` | 球场外三名球迷合影 | 11-09 组图 / 11-10 头图 |
| `carrick.jpg` | 卡里克赛前发布会 | 11-10 卡里克那条 / 11-12 晚报头图 |
| `news/news-2026-27-2026-11-11-evening.jpg` | 波切蒂诺在美国队比赛前鼓掌（2026 年 6 月，澳大利亚对美国） | 11-11 晚报头图 |
| `news/news-2026-27-2026-11-11-evening-glazer.jpg` | 阿夫拉姆·格拉泽（懂球帝配图，含队徽合成） | 11-11 晚报 格拉泽放盘那条 |
| `news/news-2026-27-2026-11-12-morning.jpg` | 老特拉福德航拍（Arne Müseler） | 11-12 早报头图 |
| `news/news-2026-27-2026-11-12-evening-statement.jpg` | 卡里克站在老特拉福德看台前（曼联官网声明配图） | 11-12 晚报 官宣那条 |
| `news/news-2026-27-2026-11-13-bruno-bbc.jpg` | B 费（BBC 正文首图） | 11-13 早报 B 费续约那条 |
| `news/news-2026-27-2026-11-13-evening.jpg` | 多古在卡灵顿（曼联官网丹麦队征召稿配图） | 11-13 晚报头图 |
| `news/news-2026-27-2026-11-13-evening-goodbye.jpg` | 芒特、多古的 IG story 截图拼图（左：芒特「Thank you Gaffer」；右：多古「Thank you coach」） | 11-13 晚报 更衣室告别那条 |
| `results-dark.svg` / `results-light.svg` | 近八场战绩条（自己画的） | 11-10 数据那条 |
| `cover.svg` | 品牌封面（自己画的，暂时没用上） | 备用 |
| `greenwood-psg.jpg` | 格林伍德在王子公园庆祝，粉色客场球衣，背后号码是巴黎字体（PSG 徽在号码里） | 2018/19 第 41 期「场边」 |
| `archive/archive-<日期>-<对手>.jpg` | 2018/19 每一场的比赛头图（52 张，ESPN 图集里的 `article.images[0]`） | 归档各期的「今日要点」大图 |

## 版权

比赛照片来自曼联官网战报页（版权属曼联 / Getty Images），抗议照片来自 Sporting News（Getty Images），`media/archive/` 里归档各期的头图来自 ESPN 图集（授权方多为 Getty / AFP，逐张署名见 `data/images-2018-19.json` 的 `credit`），战绩条和封面是自己画的。11-11 那期波切蒂诺的照片来自 Wikimedia Commons（Bryan Berlin，CC BY-SA 4.0），11-12 早报的老特拉福德航拍来自 Wikimedia Commons（Arne Müseler，CC BY-SA 3.0 de），11-13 多古的照片、官宣那条的卡里克照片来自曼联官网，B 费那条来自 BBC，格拉泽那条来自懂球帝，告别拼图是球员本人 IG story 的截图。仅作个人阅读演示，不要公开分发。

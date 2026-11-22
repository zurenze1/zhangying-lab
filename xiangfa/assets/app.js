'use strict';

const data = window.proposalV2;
const platformWords = /飞瓜(?:数据)?|(?:巨量)?星图|蝉妈妈|抖音(?:商城|小店)?|小红书|快手|微信|视频号|巨量千川|千川|TikTok|DOU\+/gi;
const displayCopy = value => String(value ?? '').replace(platformWords,'').replaceAll('核对','查证').replace(/ +/g,' ').trim();
function publicTitle(value) {
  const title = displayCopy(value);
  return title.split('#')[0].trim() || title || '作品原片';
}
async function obtainAudit() {
  if (location.protocol === 'file:') return {value:window.proposalAuditSnapshot,mode:'embedded'};
  try {
    const response = await fetch('../../数据核对/核对后数据.json', {signal:AbortSignal.timeout(1200)});
    if (response.ok) {
      const value = await response.json();
      if (value.price_match && value.metric_recheck && value.works.length===53) return {value,mode:'shared'};
    }
  } catch {}
  return {value:window.proposalAuditSnapshot,mode:'embedded'};
}

window.proposalReady = obtainAudit().then(({value:audit,mode}) => {
document.documentElement.dataset.auditSource = mode;
document.documentElement.dataset.auditVersion = audit.schema_version;
data.topics = audit.topics;
const auditedWorks = new Map(audit.works.map(work=>[work.id,work]));
for (const work of data.works) work.audit = auditedWorks.get(work.id) || work.audit;
const byId = (id) => document.getElementById(id);
const format = new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 2});
const num = (value) => format.format(value);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = displayCopy(text);
  if (className) node.className = className;
  return node;
}

function external(text, url) {
  const link = element('a', text);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function fields(pairs, className) {
  const list = element('dl', null, className);
  for (const [label, text] of pairs) {
    if (text) list.append(element('dt', label), element('dd', text));
  }
  return list;
}

function records(headers, rows, label) {
  const listing = element('div', null, 'metric-records');
  listing.setAttribute('role', 'list');
  listing.setAttribute('aria-label', displayCopy(label));
  for (const values of rows) {
    const row = element('article', null, 'metric-record');
    row.setAttribute('role','listitem');
    const title = element('h4');
    if (values[0] instanceof Node) title.append(values[0]);
    else title.textContent = displayCopy(values[0]);
    row.append(title);
    for (let column = 1; column < headers.length; column++) {
      const value = values[column];
      if (value instanceof Node) {
        row.append(value);
        continue;
      }
      const cell = element('div', null, 'metric-record-cell');
      cell.append(element('small', headers[column]), element('strong', value));
      row.append(cell);
    }
    listing.append(row);
  }
  return listing;
}

function displayTable(container, title, headers, rows) {
  container.append(element('h3', title, 'detail-heading'), records(headers, rows, title));
}

const topics = data.topics;
const workTopic = byId('work-topic');
const workSearch = byId('work-search');
for (const topic of topics) {
  const option = element('option', topic.name);
  option.value = topic.name;
  workTopic.append(option);
}

const chartLabels = {
  median_plays: '典型播放：这类视频一条一般能播多少（把这类视频的播放量从低到高排，取中间那条）。',
  median_likes_per_play_pct: '点赞率 = 点赞数 ÷ 播放量。比如 9.21%，就是每 100 个看过的人，约 9 个点了赞；先每条算，再取这类视频的中间值。',
  median_shares_per_play_pct: '分享率 = 分享数 ÷ 播放量。比如 1%，就是每 100 个看过的人，约 1 个转发给了别人；先每条算，再取中间值。',
};
function renderTopics(metric) {
  const sorted = topics.slice().sort((a, b) => b[metric] - a[metric]);
  const bars = byId('topic-bars');
  bars.replaceChildren();
  for (const [index, topic] of sorted.entries()) {
    const row = element('li', null, index === 0 ? 'bar-row featured' : 'bar-row');
    const track = element('div', null, 'bar-track');
    const fill = element('span', null, 'bar-fill');
    track.setAttribute('aria-hidden', 'true');
    fill.style.setProperty('--value', `${100 * topic[metric] / sorted[0][metric]}%`);
    track.append(fill);
    const name = element('a', topic.name, 'bar-name');
    name.href = '#works';
    name.title = `看${topic.name}的 ${topic.count} 条作品`;
    name.append(element('small', topic.count));
    name.addEventListener('click', () => {
      byId('works').open = true;
      workSearch.value = '';
      workTopic.value = topic.name;
      renderWorks();
    });
    const label = metric === 'median_plays' ? num(topic[metric]) : `${topic[metric].toFixed(2)}%`;
    row.append(name, track, element('strong', label));
    bars.append(row);
  }
  renderRadar(sorted, metric);
  byId('metric-note').textContent = chartLabels[metric] + ' 题材名后面的小数字是这类视频的条数。';
  for (const button of document.querySelectorAll('[data-metric]')) {
    button.setAttribute('aria-pressed', String(button.dataset.metric === metric));
  }
}

function renderRadar(sorted, metric) {
  const chart = byId('topic-radar');
  const plot = svg('svg',{viewBox:'0 0 270 270',role:'img','aria-label':'题材指标径向图，右侧列精确值'});
  const center=135;
  for (const r of [42,69,95,120]) plot.append(svg('circle',{cx:center,cy:center,r,fill:'none',stroke:'#d4b98c28'}));
  const maximum=sorted[0][metric] || 1;
  for (const [index,series] of sorted.entries()) {
    const angle=(index/8)*Math.PI*2-Math.PI/2;
    const point=radius=>[center+Math.cos(angle)*radius,center+Math.sin(angle)*radius];
    const [ax,ay]=point(42);
    const [bx,by]=point(42+(series[metric]/maximum)*76);
    const bar=svg('line',{x1:ax,y1:ay,x2:bx,y2:by,stroke:index===0?'#f4d5a3':'#9f805b','stroke-width':index===0?15:12,'stroke-linecap':'round'});
    bar.classList.add(index===0?'radar-primary':'radar-bar');
    const tooltip=svg('title');
    tooltip.textContent=`${series.name} · ${num(series[metric])}`;
    bar.append(tooltip);
    plot.append(bar);
  }
  const hub=element('span',metric==='median_plays'?'播放':metric==='median_likes_per_play_pct'?'点赞':'分享','radar-hub');
  chart.replaceChildren(plot,hub);
}

renderTopics('median_plays');
document.querySelectorAll('[data-metric]').forEach(button => button.addEventListener('click', () => renderTopics(button.dataset.metric)));

function svg(tag, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, val] of Object.entries(attributes)) node.setAttribute(key, val);
  return node;
}

function svgLabel(x, y, value, anchor = 'middle') {
  const node = svg('text', {x, y, 'text-anchor': anchor});
  node.textContent = value;
  return node;
}

function weeklyPlot(container) {
  const title = '每周发了几条、点赞怎么样（9 月 21 日 – 11 月 22 日）';
  const width = 770;
  const left = 57;
  const right = width - 76;
  const top = 29;
  const base = 194;
  const x = (i) => left + (i + 0.5) * (right - left) / data.weeks.length;
  const y = (value, max) => base - value / max * (base - top);
  const plot = svg('svg', { viewBox: `0 0 ${width} 225`, role: 'img', 'aria-label': '每周发布数量与典型点赞，发布日期从九月到十一月', class: 'plot' });
  plot.append(svgLabel(left, 16, '发布条数', 'start'), svgLabel(right, 16, '典型点赞', 'end'));
  for (let i = 0; i <= 4; i++) {
    const pos = y(i, 4);
    plot.append(svg('line', {x1: left, x2: right, y1: pos, y2: pos, stroke: '#dddde1'}));
    plot.append(svgLabel(left - 8, pos + 4, 2 * i, 'end'), svgLabel(width - 8, pos + 4, num(750 * i), 'end'));
  }
  const points = [];
  for (const [i, week] of data.weeks.entries()) {
    const center = x(i);
    const barTop = y(week.count, 8);
    const bar = svg('rect', {x: center - 12, y: barTop, width: 24, height: base - barTop, rx: 3, fill: '#aaaab0'});
    const tooltip = svg('title');
    tooltip.textContent = `${week.date} 这一周发了 ${week.count} 条`;
    bar.append(tooltip);
    const d0 = new Date(week.date + 'T00:00:00'); const d1 = new Date(d0.getTime() + 6 * 864e5);
    const md = (d) => `${d.getMonth() + 1}.${d.getDate()}`;
    plot.append(bar, svgLabel(center, base + 17, d0.getMonth() === d1.getMonth() ? `${md(d0)}–${d1.getDate()}` : `${md(d0)}–${md(d1)}`), svgLabel(center, barTop - 6, `${week.count} 条`));
    points.push([center, y(week.median, 3000), week]);
  }
  plot.append(svg('polyline', {
    points: points.map(([cx, cy]) => `${cx},${cy}`).join(' '), fill: 'none',
    stroke: '#a8824f', 'stroke-width': 2.75, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));
  for (const [cx, cy, week] of points) {
    const dot = svg('circle', {cx, cy, r: 4, fill: '#ffffff', stroke: '#a8824f', 'stroke-width': 2});
    const tooltip = svg('title');
    tooltip.textContent = `${week.date} · 典型点赞 ${num(week.median)}`;
    dot.append(tooltip);
    plot.append(dot);
  }
  const scroll = element('div', null, 'plot-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('aria-label', title);
  const legend = element('div', null, 'legend');
  for (const [label, className] of [['灰柱：这一周发了几条（左边刻度）', ''], ['金线：这一周的视频，点赞一般有多少（右边刻度）', 'blue']]) {
    const item = element('span');
    item.append(element('i', null, className), document.createTextNode(label));
    legend.append(item);
  }
  scroll.append(plot);
  const drill = element('details', null, 'drawer');
  drill.append(element('summary', '看每周数值'), records(
    ['这一周从哪天开始', '发了几条', '点赞一般有多少'],
    data.weeks.map((week) => [week.date, week.count, num(week.median)]), title));
  const panel = element('div', null, 'panel');
  panel.append(element('h3', title, 'detail-heading'), scroll, legend, element('p', '一根柱子就是一周（周一到周日）。发得多的周，点赞并不一定高：11.9 那周发了 7 条，点赞反而偏低；10.5 那周同样 7 条，点赞最高。差别在内容，不在条数。', 'fine'));
  container.append(panel, drill);
}

weeklyPlot(byId('weekly'));
const platform = byId('platform-data');
{
  const plain = element('article', null, 'panel wide plain-compare');
  plain.append(element('h3', '和粉丝量差不多的同类账号比（近 30 天）', 'detail-heading'));
  const rows = [
    ['播放', '一条一般 2.3 万', '比 97% 的同类号高', '内容有人愿意点开'],
    ['看完的人', '100 人里约 5 个看到最后', '只比 41% 的同类号高', '这是短板：留不住人'],
    ['互动', '100 人里约 4.5 个点赞、评论或转发', '比 78% 的同类号高', '看完的人是认可的'],
  ];
  const list = element('dl', null, 'plain-rows');
  for (const [k, v, rank, meaning] of rows) {
    const row = element('div', null, 'plain-row');
    row.append(element('dt', k), element('dd', v), element('dd', rank, 'plain-rank'), element('dd', meaning, 'plain-meaning'));
    list.append(row);
  }
  plain.append(list, element('p', '一句话：点开的人多，看完的人少。所以要先改开头和节奏，把人留住。公开数据，采集于 2026.11。', 'fine'));
  platform.append(plain);
}

byId('recent').append(element('p', data.recentMetadata, 'fine'));
displayTable(byId('recent'), '历史近 25 条互动快照', ['指标', '合计', '单条平均', '单条典型'], data.recent);
displayTable(byId('high-works'), '高表现作品 · 6 条', ['作品', '题材', '播放', '点赞', '分享'],
  data.top.map((work) => [external(publicTitle(work.title) + ' ↗', work.url), work.topic, work.display.plays, work.display.likes, work.display.shares]));

function activityPlot(values, label) {
  const scroll = element('div', null, 'plot-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('aria-label', label);
  const chart = element('div', null, 'activity-chart');
  const peak = Math.max(...values);
  for (const [hour, value] of values.entries()) {
    const clock = String(hour).padStart(2, '0');
    const cell = element('div', null, value === peak ? 'peak' : '');
    cell.title = `${clock}:00 · ${num(value)}%`;
    cell.style.setProperty('--value', `${100 * value / peak}%`);
    cell.append(element('i'), element('span', hour % 3 === 0 || value === peak ? clock : ''));
    chart.append(cell);
  }
  scroll.append(chart);
  return scroll;
}

const audience = byId('audience');
const profilePanels = element('div', null, 'profile-details');
audience.append(element('h3', '完整画像', 'detail-heading'), profilePanels);
for (const profile of [data.profiles.viewers, data.profiles.fans]) {
  const drawer = element('details', null, 'drawer');
  const body = element('div', null, 'drawer-body profile-detail-grid');
  drawer.append(element('summary', profile.label), body);
  const peak = Math.max(...profile.hours);
  const hour = String(profile.hours.indexOf(peak)).padStart(2, '0');
  const age = [['31–40 岁', profile.age]];
  const gender = [['女性', profile.female], ['男性', profile.male]];
  for (const [name, rows] of [
    ['性别', gender], ['年龄集中段', age], ['地域前十', [...profile.provinces, ...profile.additionalProvinces]],
    ['手机品牌', profile.devices], ['账号活跃度', profile.activity], ['消费价格 · 元', profile.prices],
    ['消费品类', profile.goods],
    ['一周活跃', profile.week.map((value, day) => ['周' + '一二三四五六日'[day], value])],
  ]) {
    const panel = element('article', null, 'panel');
    displayTable(panel, name, ['分类', '占比'], rows.map(([key, value]) => [key, `${num(value)}%`]));
    body.append(panel);
  }
  const activity = element('article', null, 'panel wide');
  activity.append(element('h4', '24 小时活跃', 'detail-heading'), activityPlot(profile.hours, `${profile.label}逐小时活跃`));
  activity.append(element('p', `峰值 ${hour}:00 · ${num(peak)}%`, 'fine'));
  const hours = element('details', null, 'drawer');
  hours.append(element('summary', '看 24 小时数值'), records(
    ['小时', '活跃占比'], profile.hours.map((value, i) => [`${String(i).padStart(2, '0')}:00`, `${num(value)}%`]), '逐小时活跃数值'));
  activity.append(hours);
  body.append(activity);
  profilePanels.append(drawer);
}


function panelImage([name, alt], className) {
  const image = element('img', null, className);
  image.src = `assets/${name}.webp`;
  image.alt = alt;
  const [width,height] = {
    'real-interview':[940,528],
    'real-look':[954,536],
  }[name] || [1672,941];
  image.width = width;
  image.height = height;
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

const fans = data.profiles.fans;
const [topGoods, topGoodsShare] = fans.goods.reduce((top, item) => item[1] > top[1] ? item : top);
const completion = data.starTables.flatMap(table => table.rows).find(([metric]) => metric === '完播率')[1];
const comments = window.interviewCommentSample;
const classified = comments.records - comments.categories['待判'];
const commentCount = category => comments.categories[category] ?? 0;
const commentShare = category => num(Math.round(1000 * commentCount(category) / classified) / 10) + '%';

byId('proof-fans').textContent = '约 ' + Math.round(fans.female) + '%';
byId('evidence-fans').textContent = `女性粉丝占比，偏好商品首位是${topGoods}（${num(topGoodsShare)}%） · 11 月粉丝画像估算`;
byId('proof-works').textContent = `${data.works.length} 条`;
byId('evidence-works').textContent = `分散在人物经历、生活科学等 ${topics.length} 类 · 11 月作品清单`;
byId('proof-completion').textContent = completion;
byId('proof-comments').textContent = `想买 ${commentCount('想买')} 条`;
byId('evidence-comments').textContent =
  `${comments.works} 条作品、${comments.records} 条评论记录。可分类的 ${classified} 条里，讨论占 ${commentShare('观点讨论')}，提问占 ${commentShare('提问')} · 11 月评论样本`;
byId('strategy-fans').textContent =
  `现有粉丝约 ${Math.round(fans.female)}% 是女性。先拿实用选题试，看能不能接住老粉、吸引新粉。`;
byId('comment-method').textContent =
  `评论采于 11 月 21 日公开区，覆盖 ${comments.works} 条作品、${comments.records} 条记录。${classified} 条可判主类，${comments.categories['待判']} 条待判。统计只代表当时可见样本。`;

const science = topics.find(topic => topic.name === '生活科学');
const stories = topics.find(topic => topic.name === '人物经历');
const skin = topics.find(topic => topic.name === '护肤成分');
byId('account-work-count').textContent = `${data.works.length} 条`;
byId('account-science').textContent = `${num(science.median_plays / 10000)} 万`;
byId('account-completion').textContent = completion;
for (const [label, value] of [['女性粉丝', fans.female], ['31–40 岁', fans.age], [`偏好${topGoods}`, topGoodsShare]]) {
  const fact = element('div');
  fact.append(element('dt', label), element('dd', `${num(value)}%`));
  byId('account-profile').append(fact);
}
byId('testing-basis').textContent =
  `生活科学 ${science.count} 条，典型播放 ${num(science.median_plays / 10000)} 万次；人物经历 ${stories.count} 条，典型播放 ${num(stories.median_plays / 10000)} 万次。` +
  `既有护肤成分样本只有 ${skin.count} 条。这些数据支持先试实用选题，护肤能否涨粉由试拍验证。`;

const lines = {skin: '护肤干货', life: '生活科学', story: '张博的故事', lab: '研发'};
const ideas = {
  mistakes: {line:'skin', art:'interview-cream-study', title:'洗脸时这 3 个动作，为什么值得改？',
    hook:'洗完脸发紧，就说明洗干净了吗？先看洗脸时这三个动作。',
    story:'从水温、揉搓、擦干三个洗脸动作切入，请张博说明它们对皮肤意味着什么，以及适用条件。',
    prop:'水盆、软毛巾。手部近景演一遍，再切张博解释。'},
  price: {line:'skin', art:'v5-cream', title:'贵的面霜一定更好吗？',
    hook:'一罐面霜值不值，我会先看它到底是给谁用的。',
    story:'对比使用需求、肤感和能公开查到的成品功效证据。用匿名样品，避免用价位猜效果。',
    prop:'两只去标样品罐、同一张涂抹板。先做同量对比，再解释肤感与功效证据。'},
  ingredients: {line:'skin', art:'v5-egg', title:'成分表先看这 3 处',
    hook:'看成分表，先弄明白这三处分别能告诉你什么。',
    story:'顺着一份公开成分表看标注名称、排列和产品用途，并讲清仅凭成分表能判断到哪一步。',
    prop:'匿名标签的放大打印件、笔。桌面俯拍，张博边指边讲。'},
  collagen: {line:'skin', art:'v5-helix', title:'外用胶原能到皮肤哪一层？',
    hook:'把胶原涂上去，怎么知道它最后停在哪一层？',
    story:'分清皮肤表面、进入某一层和最终功效，各自需要什么证据。只讨论能被材料支持的结论。',
    prop:'透明分层板、三股绳。先演示分层，再切回张博讲检测怎么区分。'},
  proof: {line:'skin', art:'v5-lab', title:'护肤品说有效，我会先问哪三句？',
    hook:'看到一张功效图，我会先问测的是谁、怎么测、什么时候测。',
    story:'沿一次公开可核的成品功效评价，讲清测什么、怎么对照、观察多久。',
    prop:'三张问题卡和遮去品牌的证据样张。每张卡一个镜头。'},
  yogurt: {line:'life', art:'v16-yogurt', title:'酸奶越稠，蛋白质就越多吗？',
    hook:'这两杯酸奶，一杯挂勺一杯往下流。你能靠一眼猜出哪杯蛋白质更高吗？',
    story:'从高蛋白酸奶的购物问题出发。张博讲发酵形成的蛋白质网络，以及配方和工艺怎样影响口感，最后比两杯每 100 克的蛋白质标注。',
    prop:'两杯去标酸奶、同款勺子和两张营养表。先同机位提勺对照，再给营养表特写。'},
  pineapple: {line:'life', art:'v16-pineapple', title:'鲜菠萝为什么能把牛肉腌嫩？',
    hook:'这两份牛肉切得一样厚，为什么碰过鲜菠萝汁的那份，口感会变？',
    story:'从火锅季的牛肉做法切入，让张博解释菠萝蛋白酶怎样切开肉里的蛋白质，以及时间和加热为何会改变效果。',
    prop:'同一块肉的切片、鲜菠萝汁、计时器。设一份对照，用同样方式煮熟后拍质地。'},
  father: {line:'story', art:'v5-village', title:'我爸那句话，我到现在还记得',
    hook:'我爸有次跟我说了一句话，我到现在还记得。',
    story:'请张博用自己的话讲父亲当时说了什么、自己为什么记住。现场确认原话和细节再入稿。',
    prop:'一张获家属同意的旧照片，或纸笔。窗边单机位，留停顿。'},
  return: {line:'story', art:'real-interview', title:'有了英国永居，他为什么还要回国？',
    hook:'我在英国本来打算留下来，后来还是决定回国。',
    story:'让张博确认并复述自己在英国工作、拿到永居、决定回国时面对的具体选择。',
    prop:'获准的旧照片和一张空白时间卡。先从人像半身起，再插照片。'},
  science: {line:'story', art:'real-lab-grade.png', title:'做蛋白质研究，怎么后来做起面霜？',
    hook:'在英国研究的是蛋白质，后来怎么走到了护肤这一步？',
    story:'用一件科研工作说清张博遇到的问题，以及他怎样把它带到产品开发。保留本人原话。',
    prop:'一件获准展示的实验室样品。先镜外提问，再跟拍手部。'},
  tests: {line:'lab', art:'v5-instrument', title:'一罐面霜上架前，要过哪些检测？',
    hook:'实验室的小样好用，离一款产品能上架还有几步？',
    story:'用一份获准公开的研发流程说明团队实际做了哪些检测、各在排查什么。',
    prop:'留样罐、实验记录、报告可公开页。手部与检测台来回切。'},
  stability: {line:'lab', art:'v5-lab', title:'为什么实验室要把面霜放进恒温箱？',
    hook:'一罐样品进恒温箱，出来以后我们先看什么？',
    story:'跟拍团队同意公开的一步稳定性观察，解释这一项结果能回答什么。',
    prop:'恒温箱、不同批次的样品。先拍取样，再让张博指给观众看。'},
  report: {line:'lab', art:'v6-helix-still', title:'一份面霜检测报告，先看哪里？',
    hook:'我拿到检测报告，先找样品和条件，再看结果。',
    story:'用获准公开的报告页确认受测样品、测试条件和能够支持的说法。',
    prop:'获准公开的报告局部与标笔。只拍批准范围。'},
  sample: {line:'lab', art:'opening-preview.jpg', title:'第一罐样品，和最后上架的差多远？',
    hook:'同一款面霜，我们为什么会留好几版样品？',
    story:'拿两份获准公开的样品，请张博说明一次有记录的调整和对应测试。',
    prop:'两只编号样品瓶、实验记录。先拍编号，再拍张博解释一次调整。'},
};
const mixes = [
  {name:'稳健（建议）', order:['mistakes','yogurt','father','collagen','pineapple','ingredients','proof','tests']},
  {name:'均衡', order:['mistakes','yogurt','father','collagen','pineapple','return','proof','tests']},
  {name:'偏研发', order:['mistakes','father','yogurt','collagen','tests','return','stability','report']},
];
const ratioControls = byId('ratios');
const trialGrid = byId('trials');
const trialDialog = byId('trial-detail');
const trialTitle = byId('trial-title');
const trialDetails = byId('trial-content');
let openedCard;

function mixCounts(mix) {
  return Object.entries(lines).map(([key, label]) => [label, mix.order.filter(id => ideas[id].line === key).length]);
}

function selectMix(mix) {
  for (const button of ratioControls.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.mix === mix.name));
  }
  byId('ratio-note').textContent = '8 条里：' + mixCounts(mix).map(([label, count]) => `${label} ${count} 条`).join('、');
  trialGrid.replaceChildren(...mix.order.map((id, index) => {
    const idea = ideas[id];
    const card = element('button', null, 'trial trial-button');
    card.type = 'button';
    card.dataset.line = idea.line;
    card.setAttribute('aria-haspopup', 'dialog');
    const copy = element('span', null, 'trial-card-copy');
    copy.append(element('span', `${String(index+1).padStart(2,'0')} · ${lines[idea.line]}`, 'trial-meta'),
      element('strong', idea.title), element('span','↗','trial-open-icon'));
    copy.lastElementChild.setAttribute('aria-hidden','true');
    const photo = idea.art.includes('.') ? element('img', null, 'trial-photo') : panelImage([idea.art,''], 'trial-photo');
    if (idea.art.includes('.')) {
      photo.src = 'assets/' + idea.art;
      photo.alt = '';
      photo.loading = 'lazy';
    }
    card.append(photo, copy);
    card.addEventListener('click', () => {
      openedCard = card;
      trialTitle.textContent = idea.title;
      trialDetails.replaceChildren(fields([
        ['这条讲什么', idea.story], ['开头第一句', idea.hook], ['道具与拍法', idea.prop],
      ], 'trial-fields'));
      trialDialog.showModal();
    });
    return card;
  }));
}
for (const mix of mixes) {
  const button = element('button',null,'ratio-button');
  button.type = 'button';
  button.dataset.mix = mix.name;
  const ratios = mixCounts(mix).map(([label, count]) => `${label} ${count}`).join(' · ');
  button.append(element('strong',mix.name), element('span',ratios,'ratio-counts'));
  button.addEventListener('click', () => selectMix(mix));
  ratioControls.append(button);
}
trialDialog.addEventListener('close', () => openedCard?.focus({preventScroll:true}));
selectMix(mixes[0]);

const readingColumns = [
  ['开头', 'opening_paraphrase'], ['表达', 'expression'], ['结构', 'structure'], ['拍法', 'visual_observation'],
  ['保留', 'retain'], ['问题', 'issue'], ['改拍', 'revision_proposal'], ['产品衔接', 'product_connection'], ['拆解依据', 'reading_method'],
];
function clipTimestamp(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}`;
}
function workDetails(work) {
  const info = element('details', null, 'work-detail');
  info.append(element('summary', '看拆解'));
  const pairs = readingColumns.map(([label, key]) => {
    const value = work[key];
    if (key !== 'structure' && key !== 'visual_observation') return [label, value];
    const withTimecodes = value?.replace(/\b\d+(?:[–、]\d+)*\s*秒/g,
      time => time.replace(/\d+/g, seconds => clipTimestamp(+seconds)).replace(/\s*秒$/,''));
    return [label, withTimecodes];
  });
  const live = work.audit.display;
  pairs.push(['公开累计 · 11.20', `播放 ${live.plays} · 点赞 ${live.likes} · 评论 ${live.comments} · 分享 ${live.shares}`]);
  if (work.audit.collects_evidence) {
    const collect = work.audit.collects_evidence;
    pairs.push(['收藏', `${collect.display} · ${collect.observed_on}`]);
  }
    const measure = (raw,suffix) => raw==null ? '需后台' : `${num(raw)}${suffix}`;
  pairs.push(['完播率',measure(work.audit.completion_pct,'%')],['前 5 秒',measure(work.audit.first_5s_completion_pct,'%')],
    ['平均观看时长',measure(work.audit.avg_watch_seconds,' 秒')],['单条涨粉',measure(work.audit.gained_follows,' 人')]);
  if (work.duration_seconds) pairs.push(['时长', clipTimestamp(Math.round(work.duration_seconds))]);
  if (work.metrics_observed_on) pairs.push(['点赞快照', work.metrics_observed_on]);
  info.append(fields(pairs));
  return info;
}
function renderWorks() {
  const keyword = workSearch.value.trim().toLowerCase();
  const topic = workTopic.value;
  const matches = data.works.filter((work) => (!topic || topic === work.topic) &&
    (!keyword || [work.title, work.id, ...readingColumns.map(([, key]) => work[key])].join(' ').toLowerCase().includes(keyword)));
  byId('work-count').textContent = `${matches.length} / ${data.works.length} 条作品`;
  const container = byId('work-table');
  if (!matches.length) {
    container.replaceChildren(element('p', '没有找到匹配作品。', 'fine'));
    return;
  }
  const wrap = records(['原片', '题材', '发布时间', '播放', '点赞率', '拆解'], matches.map((work) => [
    external(publicTitle(work.title), work.url), work.topic, work.published_at, work.audit.display.plays, `${work.audit.likes_per_play_pct.toFixed(2)}%`, workDetails(work),
  ]), '张影作品拆解');
  wrap.classList.add('work-records');
  container.replaceChildren(wrap);
}
workSearch.addEventListener('input', renderWorks);
workTopic.addEventListener('change', renderWorks);
renderWorks();

performance.mark('proposal-controls-ready');
document.documentElement.dataset.proposalReady='true';
});

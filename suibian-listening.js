var axios = require('axios');
var request = axios.default || axios;

var NETEASE_HEADERS = {
  Referer: 'https://music.163.com/',
  Cookie: 'os=pc; appver=2.9.7',
};

var SOURCES = [
  { platform: 'netease', id: 3778678, name: '热歌榜' },
  { platform: 'netease', id: 19723756, name: '飙升榜' },
  { platform: 'netease', id: 3779629, name: '新歌榜' },
  { platform: 'netease', id: 2250011882, name: '抖音榜' },
  { platform: 'netease', id: 2884035, name: '怀旧金曲' },
  { platform: 'kuwo', id: 16, name: '酷我热歌榜' },
  { platform: 'kuwo', id: 93, name: '酷我飙升榜' },
  { platform: 'kuwo', id: 158, name: '短视频热歌榜' },
  { platform: 'kuwo', id: 63, name: '酷我网络榜' },
  { platform: 'kuwo', id: 76, name: '夜店舞曲榜' },
  { platform: 'kuwo', id: 17, name: '酷我新歌榜' },
  { platform: 'kuwo', id: 26, name: '酷我经典榜' },
  { platform: 'qq', id: 4, name: '巅峰榜·流行指数' },
  { platform: 'qq', id: 26, name: '巅峰榜·热歌' },
  { platform: 'qq', id: 27, name: '巅峰榜·新歌' },
  { platform: 'qq', id: 3, name: '巅峰榜·欧美' },
  { platform: 'qq', id: 5, name: '巅峰榜·内地' },
  { platform: 'qq', id: 6, name: '巅峰榜·港台' },
  { platform: 'qq', id: 16, name: '巅峰榜·韩国' },
  { platform: 'qq', id: 17, name: '巅峰榜·日本' },
  { platform: 'qq', id: 62, name: '飙升榜' },
  { platform: 'qq', id: 105, name: '日本公信榜' },
];

function norm(s) {
  return String(s || '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function joinArtists(list) {
  var parts = [];
  for (var i = 0; i < (list || []).length; i++) {
    if (list[i] && list[i].name) parts.push(list[i].name);
  }
  return parts.join(' / ') || '未知歌手';
}

function neteaseItem(song) {
  return {
    id: song.id,
    title: song.name,
    artist: joinArtists(song.artists),
    album: song.album && song.album.name,
    pic: song.album && (song.album.picUrl || song.album.blurPicUrl),
    duration: song.duration ? song.duration / 1000 : 0,
    platform: 'suibian',
  };
}

function kuwoItem(song) {
  return {
    id: song.id,
    title: song.name,
    artist: song.artist || '未知歌手',
    album: song.album,
    duration: song.duration ? song.duration / 1000 : 0,
    platform: 'suibian',
  };
}

function qqItem(song) {
  var d = song.data || song;
  return {
    id: d.songmid,
    title: d.songname,
    artist: joinArtists(d.singer),
    album: d.albumname,
    pic: d.albummid ? 'https://y.gtimg.cn/music/photo_new/T002R500x500M000' + d.albummid + '.jpg' : undefined,
    duration: d.interval || 0,
    platform: 'suibian',
  };
}

async function fetchNeteaseList(id) {
  var res = await request.get('https://music.163.com/api/playlist/detail', {
    params: { id: id },
    headers: NETEASE_HEADERS,
    timeout: 20000,
  });
  var data = res && res.data;
  if (!data || data.code !== 200) return [];
  var list = data.playlist || data.result;
  if (!list || !list.tracks) return [];
  var items = [];
  for (var i = 0; i < list.tracks.length; i++) items.push(neteaseItem(list.tracks[i]));
  return items;
}

async function fetchKuwoList(id) {
  var res = await request.get('http://kbangserver.kuwo.cn/ksong.s', {
    params: { from: 'pc', fmt: 'json', type: 'bang', data: 'content', pn: 0, rn: 300, id: id },
    timeout: 20000,
  });
  var data = res && res.data;
  if (!data || !data.musiclist) return [];
  var items = [];
  for (var i = 0; i < data.musiclist.length; i++) items.push(kuwoItem(data.musiclist[i]));
  return items;
}

async function fetchQqList(id) {
  var res = await request.get('https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg', {
    params: { page: 'detail', topid: id, type: 'top', tpl: 3, g_tk: 5381, format: 'json', inCharset: 'utf8', outCharset: 'utf-8' },
    timeout: 20000,
  });
  var data = res && res.data;
  if (!data || data.code !== 0 || !data.songlist) return [];
  var items = [];
  for (var i = 0; i < data.songlist.length; i++) items.push(qqItem(data.songlist[i]));
  return items;
}

async function fetchSourceSongs(platform, id) {
  if (platform === 'netease') return fetchNeteaseList(id);
  if (platform === 'kuwo') return fetchKuwoList(id);
  if (platform === 'qq') return fetchQqList(id);
  return [];
}

async function neteaseSearch(keyword, page) {
  var offset = (page - 1) * 30;
  var body = 's=' + encodeURIComponent(keyword) + '&type=1&offset=' + offset + '&total=true&limit=30';
  var res = await request.post('https://music.163.com/api/search/get/web', body, {
    headers: Object.assign({}, NETEASE_HEADERS, { 'Content-Type': 'application/x-www-form-urlencoded' }),
    timeout: 15000,
  });
  var data = res && res.data;
  if (!data || data.code !== 200 || !data.result) return { isEnd: true, data: [] };
  var songs = data.result.songs || [];
  var list = [];
  for (var i = 0; i < songs.length; i++) {
    var s = songs[i];
    list.push({
      id: s.id,
      title: s.name,
      artist: joinArtists(s.ar || s.artists),
      album: s.al && s.al.name,
      pic: s.al && s.al.picUrl,
      duration: s.dt ? s.dt / 1000 : 0,
      platform: 'suibian',
    });
  }
  return { isEnd: list.length < 30, data: list };
}

async function search(query, page, type) {
  if (type === 'music') return neteaseSearch(query, page);
  return { isEnd: true, data: [] };
}

function topListGroup(title, sources) {
  var data = [];
  for (var i = 0; i < sources.length; i++) {
    data.push({ title: sources[i].name, id: sources[i].platform + ':' + sources[i].id });
  }
  return { title: title, data: data };
}

async function getTopLists() {
  return [
    {
      title: '随便听听',
      data: [{ title: '无限随机·随便听听', id: '__random__' }],
    },
    topListGroup('网易云官方榜单', SOURCES.filter(function (s) { return s.platform === 'netease'; })),
    topListGroup('酷我官方榜单', SOURCES.filter(function (s) { return s.platform === 'kuwo'; })),
    topListGroup('QQ音乐官方榜单', SOURCES.filter(function (s) { return s.platform === 'qq'; })),
  ];
}

var randomCache = {};
var randomUsed = {};
var randomUsedCount = 0;

function songHash(s) {
  return norm(s.title) + '|' + norm(s.artist);
}

async function getRandomBatch(count) {
  var batch = [];
  var attempts = 0;
  while (batch.length < count && attempts < 8) {
    attempts++;
    var src = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    var key = src.platform + ':' + src.id;
    var songs = randomCache[key];
    if (!songs) {
      try {
        songs = await fetchSourceSongs(src.platform, src.id);
      } catch (e) {
        songs = [];
      }
      randomCache[key] = songs;
    }
    var fresh = [];
    for (var i = 0; i < songs.length; i++) {
      if (!randomUsed[songHash(songs[i])]) fresh.push(songs[i]);
    }
    shuffle(fresh);
    for (var j = 0; j < fresh.length && j < 30 && batch.length < count; j++) {
      batch.push(fresh[j]);
      randomUsed[songHash(fresh[j])] = true;
      randomUsedCount++;
    }
  }
  if (batch.length === 0 && randomUsedCount > 0) {
    randomUsed = {};
    randomUsedCount = 0;
    return getRandomBatch(count);
  }
  return batch;
}

async function getTopListDetail(topListItem, page) {
  if (!topListItem || !topListItem.id) return { isEnd: true, musicList: [] };
  if (topListItem.id === '__random__') {
    var batch = await getRandomBatch(100);
    return { isEnd: false, musicList: batch };
  }
  var parts = topListItem.id.split(':');
  var platform = parts[0];
  var listId = Number(parts[1]);
  var musicList = [];
  try {
    musicList = await fetchSourceSongs(platform, listId);
  } catch (e) {
    musicList = [];
  }
  return { isEnd: true, musicList: musicList };
}

var BILI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
var biliCookie = null;

async function biliCookieString() {
  if (!biliCookie) {
    var res = await request.get('https://api.bilibili.com/x/frontend/finger/spi', {
      headers: { 'User-Agent': BILI_UA },
      timeout: 10000,
    });
    biliCookie = res && res.data && res.data.data;
  }
  if (biliCookie && biliCookie.b_3) {
    return 'buvid3=' + biliCookie.b_3 + ';buvid4=' + (biliCookie.b_4 || '');
  }
  return '';
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '').trim();
}

function normText(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').toLowerCase();
}

async function biliSearch(keyword) {
  var ck = await biliCookieString();
  var res = await request.get('https://api.bilibili.com/x/web-interface/search/type', {
    params: { search_type: 'video', keyword: keyword, page: 1, page_size: 20, highlight: 1, platform: 'pc' },
    headers: {
      'User-Agent': BILI_UA,
      Referer: 'https://search.bilibili.com/',
      Cookie: ck,
      accept: 'application/json',
    },
    timeout: 15000,
  });
  var data = res && res.data;
  if (!data || data.code !== 0 || !data.data) return [];
  return data.data.result || [];
}

function biliPickFirst(results, songTitle) {
  if (!results || !results.length) return null;
  var t = normText(songTitle);
  for (var i = 0; i < results.length; i++) {
    var title = normText(results[i].title);
    if (t.length > 1 && (title.indexOf(t) >= 0 || t.indexOf(title) >= 0)) {
      return results[i];
    }
  }
  return results[0];
}

async function biliResolveUrl(bvid) {
  var view = await request.get('https://api.bilibili.com/x/web-interface/view', {
    params: { bvid: bvid },
    headers: { 'User-Agent': BILI_UA },
    timeout: 15000,
  });
  var cid = view && view.data && view.data.data && view.data.data.cid;
  if (!cid) return null;
  var play = await request.get('https://api.bilibili.com/x/player/playurl', {
    params: { bvid: bvid, cid: cid, fnval: 16 },
    headers: { 'User-Agent': BILI_UA },
    timeout: 15000,
  });
  var p = play && play.data && play.data.data;
  if (!p) return null;
  var url = null;
  if (p.dash && p.dash.audio && p.dash.audio.length) {
    p.dash.audio.sort(function (a, b) {
      return a.bandwidth - b.bandwidth;
    });
    url = p.dash.audio[p.dash.audio.length - 1].baseUrl;
  }
  if (!url && p.durl && p.durl.length) {
    url = p.durl[0].url;
  }
  if (!url) return null;
  return {
    url: url,
    headers: {
      Referer: 'https://www.bilibili.com/',
      'User-Agent': BILI_UA,
    },
  };
}

async function getMediaSource(musicItem, quality) {
  if (!musicItem) return null;
  var songTitle = musicItem.title || '';
  var songArtist = musicItem.artist || '';
  var keyword = (songTitle + ' ' + songArtist).trim();
  if (!songTitle) return null;
  try {
    var results = await biliSearch(keyword);
    var picked = biliPickFirst(results, songTitle);
    if (!picked && songArtist) {
      var results2 = await biliSearch(songTitle);
      picked = biliPickFirst(results2, songTitle);
    }
    if (!picked || !picked.bvid) return null;
    return await biliResolveUrl(picked.bvid);
  } catch (e) {
    return null;
  }
}

module.exports = {
  platform: 'suibian',
  version: '0.1.0',
  author: 'you',
  description: '多平台官方榜单无限随机播放，按歌名+歌手用bilibili搜索直接播放',
  srcUrl: '',
  cacheControl: 'no-cache',
  supportedSearchType: ['music'],
  search: search,
  getTopLists: getTopLists,
  getTopListDetail: getTopListDetail,
  getMediaSource: getMediaSource,
};

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
    sourcePlatform: 'netease',
    sourceId: String(song.id),
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
    sourcePlatform: 'kuwo',
    sourceId: String(song.id),
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
    sourcePlatform: 'qq',
    sourceId: String(d.songmid),
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
      sourcePlatform: 'netease',
      sourceId: String(s.id),
    });
  }
  return { isEnd: list.length < 30, data: list };
}

function parseBiliVideoTitle(rawTitle) {
  var t = stripTags(rawTitle || '');
  var songTitle = '';
  var songArtist = '';
  var m1 = t.match(/\u300a([^\u300a\u300b]+)\u300b/);
  if (m1) {
    songTitle = m1[1].trim();
    var before = t.substring(0, m1.index).trim();
    var am = before.match(/([\u4e00-\u9fa5\w]+\s*)$/);
    if (am) songArtist = am[1].trim();
  }
  if (!songTitle) {
    var m2 = t.match(/([\u4e00-\u9fa5\w]+)\s*[-\u2014]\s*([\u4e00-\u9fa5\w]+)/);
    if (m2) {
      songArtist = m2[1].trim();
      songTitle = m2[2].trim();
    }
  }
  if (!songTitle) {
    var cleaned = t.replace(/\[([^\]]*)\]/g, '').replace(/\uff08([^\uff09]*)\uff09/g, '').replace(/\(([^\)]*)\)/g, '').trim();
    var parts = cleaned.split(/\s*[-\u2014]\s*/);
    if (parts.length >= 2) {
      songTitle = parts[0].trim();
      songArtist = parts[1].trim();
    } else {
      songTitle = cleaned;
    }
  }
  if (songTitle.length > 30) songTitle = songTitle.substring(0, 30);
  if (songArtist.length > 20) songArtist = songArtist.substring(0, 20);
  return { title: songTitle, artist: songArtist };
}

async function biliSearchToMusicItems(keyword, page) {
  try {
    var results = await biliSearch(keyword, page);
    var filtered = filterBiliResults(results);
    var list = [];
    for (var i = 0; i < filtered.length; i++) {
      var r = filtered[i];
      var dur = parseBiliDuration(r.duration);
      var parsed = parseBiliVideoTitle(r.title);
      list.push({
        id: r.bvid || ('bili_' + i),
        title: parsed.title || stripTags(r.title || ''),
        artist: parsed.artist || r.author || '未知UP主',
        album: r.tag || 'Bilibili',
        pic: r.pic && r.pic.startsWith('//') ? 'https:' + r.pic : r.pic,
        duration: dur,
        platform: 'suibian',
      });
    }
    return { isEnd: results.length < 20, data: list };
  } catch (e) {
    return { isEnd: true, data: [] };
  }
}

async function search(query, page, type) {
  if (type === 'music') return biliSearchToMusicItems(query, page);
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
var randomCacheTime = {};
var randomCacheTTL = 30 * 60 * 1000;
var randomUsed = {};
var randomUsedCount = 0;
var RANDOM_USED_MAX = 3000;

function songHash(s) {
  return norm(s.title) + '|' + norm(s.artist);
}

function purgeOldCache() {
  var now = Date.now();
  var keys = Object.keys(randomCache);
  for (var i = 0; i < keys.length; i++) {
    if (randomCacheTime[keys[i]] && now - randomCacheTime[keys[i]] > randomCacheTTL) {
      delete randomCache[keys[i]];
      delete randomCacheTime[keys[i]];
    }
  }
}

function cleanupUsed() {
  if (randomUsedCount > RANDOM_USED_MAX) {
    console.log('[suibian] randomUsed exceeded ' + RANDOM_USED_MAX + ', resetting dedup map');
    randomUsed = {};
    randomUsedCount = 0;
  }
}

async function getRandomBatch(count) {
  purgeOldCache();
  cleanupUsed();
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
        console.log('[suibian] fetch random list failed:', src.platform, src.id, e.message || e);
        songs = [];
      }
      randomCache[key] = songs;
      randomCacheTime[key] = Date.now();
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
    console.log('[suibian] song pool exhausted, resetting dedup map');
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
    console.log('[suibian] fetch top list failed:', platform, listId, e.message || e);
    musicList = [];
  }
  return { isEnd: true, musicList: musicList };
}

var BILI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
var biliCookie = null;
var biliCookieTime = 0;
var BILI_COOKIE_TTL = 30 * 60 * 1000;

async function biliCookieString() {
  var now = Date.now();
  if (!biliCookie || now - biliCookieTime > BILI_COOKIE_TTL) {
    biliCookie = null;
    try {
      var res = await request.get('https://api.bilibili.com/x/frontend/finger/spi', {
        headers: { 'User-Agent': BILI_UA },
        timeout: 10000,
      });
      biliCookie = res && res.data && res.data.data;
      if (biliCookie) biliCookieTime = now;
    } catch (e) {
      console.log('[suibian] bilibili cookie fetch failed:', e.message || e);
      biliCookie = null;
    }
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

async function biliSearch(keyword, page) {
  var ck = await biliCookieString();
  var res = await request.get('https://api.bilibili.com/x/web-interface/search/type', {
    params: { search_type: 'video', keyword: keyword, page: page || 1, page_size: 20, highlight: 1, platform: 'pc' },
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

var BILI_COMPILED = /\u5408\u96c6|\u7cbe\u9009|\u5408\u5ega|\u5408\u96c6|100\u9996|200\u9996|\u5341\u5927|\u767e\u9996|\u5341\u5e74|\u7ecf\u5178|\u5386\u53f2|\u6392\u884c/i;

function parseBiliDuration(s) {
  if (!s) return 0;
  s = String(s).trim();
  if (s.indexOf(':') >= 0) {
    var parts = s.split(':');
    if (parts.length === 3) {
      var h = parseInt(parts[0], 10) || 0;
      var m = parseInt(parts[1], 10) || 0;
      var sec = parseInt(parts[2], 10) || 0;
      return h * 3600 + m * 60 + sec;
    }
    var m2 = parseInt(parts[0], 10) || 0;
    var sec2 = parseInt(parts[1], 10) || 0;
    return m2 * 60 + sec2;
  }
  return parseInt(s, 10) || 0;
}

function filterBiliResults(results) {
  var out = [];
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var dur = parseBiliDuration(r.duration);
    if (dur > 0 && (dur < 60 || dur > 600)) continue;
    var title = stripTags(r.title || '');
    if (BILI_COMPILED.test(title)) continue;
    out.push(r);
  }
  return out;
}

var BILI_BLACKLIST = /\u7ffb\u5531|\u4f34\u594f|cover|instrumental|\u6559\u5b66|\u5408\u96c6|mv|\u52a8\u753b|live|\u73b0\u573a|reaction|\u8bd7\u8bd7\u8bd7|\u8bd7\u8bd7\u8bd7\u8bd7|\u5206\u6790|\u89e3\u8bf4|\u6df7\u526a|\u7eaf\u97f3\u4e50|karaoke|\u7ffb\u8bd7|\u7ffb\u5531\u7ffb\u8bd7/i;
var BILI_LOWQUALITY = /\u5e7f\u573a\u821e|\u591c\u5e97|dj|\u64c5\u81ea|\u623f\u5c45|\u517c\u804c|\u573a\u5730|funk|\u6d6e\u827e|\u706b\u7130|\u70ed\u6b4c\u697c|\u70ed\u95e8/i;
var BILI_OFFICIAL_TAG = /\u5b98\u65b9|\u5b98\u65b9MV|\u5b98\u65b9\u7248\u672c|\u6b63\u5f0fMV|\u539f\u7248|\u539f\u5531|\u6b63\u7248/i;

function scoreBiliResult(item, songTitle, songArtist) {
  var title = stripTags(item.title || '');
  var nTitle = normText(title);
  var nSong = normText(songTitle);
  var nArtist = normText(songArtist || '');
  var score = 0;

  if (!nSong || nSong.length < 1) return 0;

  if (nTitle === nSong) {
    score += 40;
  } else if (nTitle.indexOf(nSong) === 0) {
    score += 35;
  } else if (nTitle.indexOf(nSong) >= 0) {
    score += 25;
  } else if (nSong.indexOf(nTitle) >= 0 && nTitle.length >= 2) {
    score += 15;
  } else {
    return 0;
  }

  if (BILI_BLACKLIST.test(title)) score -= 30;
  if (BILI_LOWQUALITY.test(title)) score -= 15;
  if (BILI_OFFICIAL_TAG.test(title)) score += 10;

  var dur = parseBiliDuration(item.duration);
  if (dur > 0) {
    if (dur >= 120 && dur <= 360) {
      score += 20;
    } else if (dur >= 60 && dur <= 600) {
      score += 10;
    } else {
      score -= 10;
    }
  }

  if (nArtist.length > 0) {
    var author = normText(item.author || '');
    if (author.indexOf(nArtist) >= 0 || nArtist.indexOf(author) >= 0) {
      score += 10;
    } else if (nTitle.indexOf(nArtist) >= 0) {
      score += 5;
    }
  }

  var playCount = parseInt(item.play, 10) || 0;
  if (playCount > 1000000) score += 5;
  else if (playCount > 100000) score += 3;

  return Math.max(score, 0);
}

function biliPickFirst(results, songTitle, songArtist) {
  if (!results || !results.length) return null;
  var best = null;
  var bestScore = 0;
  for (var i = 0; i < results.length; i++) {
    var s = scoreBiliResult(results[i], songTitle, songArtist);
    if (s > bestScore) {
      bestScore = s;
      best = results[i];
    }
  }
  if (best && bestScore < 20) {
    console.log('[suibian] low quality match (score ' + bestScore + '):', stripTags(best.title), '| fallback from:', songTitle);
  }
  return best || results[0];
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
    params: { bvid: bvid, cid: cid, fnval: 0,qn: 64 },
    headers: { 'User-Agent': BILI_UA },
    timeout: 15000,
  });
  var p = play && play.data && play.data.data;
  if (!p) return null;
  var url = null;
  if (p.durl && p.durl.length) {
    url = p.durl[0].url;
  }
  if (!url && p.dash && p.dash.audio && p.dash.audio.length) {
    p.dash.audio.sort(function (a, b) {
      return a.bandwidth - b.bandwidth;
    });
    url = p.dash.audio[p.dash.audio.length - 1].baseUrl;
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

async function searchBiliMultiPage(keyword, maxPages) {
  var all = [];
  for (var p = 1; p <= maxPages; p++) {
    try {
      var page = await biliSearch(keyword, p);
      if (!page || !page.length) break;
      all = all.concat(page);
      if (p < maxPages) await new Promise(function (r) { setTimeout(r, 250); });
    } catch (e) {
      break;
    }
  }
  return all;
}

async function getMediaSource(musicItem, quality) {
  if (!musicItem) return null;
  var songTitle = musicItem.title || '';
  var songArtist = musicItem.artist || '';
  if (!songTitle) return null;
  try {
    var keyword = (songTitle + ' ' + songArtist).trim();
    var raw = await searchBiliMultiPage(keyword, 2);
    var filtered = filterBiliResults(raw);
    var picked = biliPickFirst(filtered, songTitle, songArtist);
    if (!picked && songArtist) {
      var raw2 = await searchBiliMultiPage(songTitle, 2);
      var filtered2 = filterBiliResults(raw2);
      picked = biliPickFirst(filtered2, songTitle, songArtist);
    }
    if (!picked || !picked.bvid) return null;
    return await biliResolveUrl(picked.bvid);
  } catch (e) {
    console.log('[suibian] getMediaSource failed:', songTitle, '-', songArtist, e.message || e);
    return null;
  }
}

var lyricCache = {};
var LYRIC_CACHE_TTL = 5 * 60 * 1000;

function getLyricCacheKey(platform, id) {
  return platform + ':' + id;
}

function getCachedLyric(platform, id) {
  var key = getLyricCacheKey(platform, id);
  var entry = lyricCache[key];
  if (entry && Date.now() - entry.time < LYRIC_CACHE_TTL) {
    return entry.lyric;
  }
  return null;
}

function setCachedLyric(platform, id, lyric) {
  var key = getLyricCacheKey(platform, id);
  lyricCache[key] = { lyric: lyric, time: Date.now() };
}

function generatePseudoLrc(plainText, durationSec) {
  if (!plainText) return null;
  var lines = plainText.split('\n');
  var filtered = [];
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim();
    if (t.length > 0) filtered.push(t);
  }
  if (!filtered.length) return null;
  var dur = (durationSec && durationSec > 0) ? durationSec : 240;
  var interval = dur / (filtered.length + 1);
  var lrc = [];
  for (var j = 0; j < filtered.length; j++) {
    var sec = Math.floor(interval * (j + 1));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    var ts = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    lrc.push('[' + ts + ']' + filtered[j]);
  }
  return lrc.join('\n');
}

function hasLrcTimestamps(text) {
  return text && /^\[\d{2}:\d{2}[.:]\d{2,3}\]/m.test(text);
}

function stripVersionTag(s) {
  return String(s || '').replace(/\s*[\(（][^\)）]*[\)）]\s*/g, '').trim();
}

async function fetchLrclibLyric(title, artist) {
  var params = { track_name: title };
  if (artist) params.artist_name = artist;
  var res = await request.get('https://lrclib.net/api/get', {
    params: params,
    headers: { 'User-Agent': 'SuibianListening/0.1 MusicFree Plugin' },
    timeout: 10000,
  });
  var data = res && res.data;
  if (!data) return null;
  if (data.syncedLyrics) return { text: data.syncedLyrics, synced: true };
  if (data.plainLyrics) return { text: data.plainLyrics, synced: false, duration: data.duration };
  return null;
}

function pickBestLrclibResult(results, title, artist) {
  if (!results || !results.length) return null;
  var t = normText(title);
  var a = normText(artist || '');
  var best = null;
  var bestScore = -1;
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var nTrack = normText(r.trackName || '');
    var nArtist = normText(r.artistName || '');
    var s = 0;
    if (nTrack === t) s += 10;
    else if (nTrack.indexOf(t) >= 0 || t.indexOf(nTrack) >= 0) s += 5;
    else continue;
    if (a && nArtist) {
      if (nArtist.indexOf(a) >= 0 || a.indexOf(nArtist) >= 0) s += 3;
    }
    if (r.syncedLyrics) s += 2;
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  if (!best) {
    for (var j = 0; j < results.length; j++) {
      if (results[j].syncedLyrics) return results[j];
    }
    return results[0] || null;
  }
  return best;
}

async function fetchLrclibSearch(title, artist) {
  var q = title + (artist ? ' ' + artist : '');
  var res = await request.get('https://lrclib.net/api/search', {
    params: { q: q },
    headers: { 'User-Agent': 'SuibianListening/0.1 MusicFree Plugin' },
    timeout: 10000,
  });
  var data = res && res.data;
  if (!data || !data.length) return null;
  var best = pickBestLrclibResult(data, title, artist);
  if (best && best.syncedLyrics) return { text: best.syncedLyrics, synced: true };
  if (best && best.plainLyrics) return { text: best.plainLyrics, synced: false, duration: best.duration };
  return null;
}

async function fetchKugouLyric(title, artist, duration) {
  var keyword = title + (artist ? ' ' + artist : '');
  var dur = (duration && duration > 0) ? Math.floor(duration) : 0;
  var searchUrl = 'https://lyrics2.kugou.com/search?ver=1&man=yes&client=mobi&keyword=' + encodeURIComponent(keyword) + '&duration=' + dur + '&hash=';
  var res = await request.get(searchUrl, { timeout: 10000 });
  var data = res && res.data;
  if (!data || !data.candidates || !data.candidates.length) return null;
  var c = data.candidates[0];
  var dlUrl = 'https://lyrics2.kugou.com/download?ver=1&client=pc&id=' + c.id + '&accesskey=' + c.accesskey + '&fmt=lrc&charset=utf8';
  var res2 = await request.get(dlUrl, { timeout: 10000 });
  var data2 = res2 && res2.data;
  if (!data2 || !data2.content) return null;
  var decoded = '';
  try {
    decoded = decodeURIComponent(escape(atob(data2.content)));
  } catch (e) {
    try {
      var buf = Buffer.from(data2.content, 'base64');
      decoded = buf.toString('utf-8');
    } catch (e2) {
      return null;
    }
  }
  decoded = decoded.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return decoded.trim() || null;
}

function resolveLrcResult(result, musicItem) {
  if (!result || !result.text) return null;
  if (result.synced || hasLrcTimestamps(result.text)) return result.text;
  var dur = (result.duration && result.duration > 0) ? result.duration : (musicItem.duration || 240);
  return generatePseudoLrc(result.text, dur);
}

async function getLyric(musicItem) {
  if (!musicItem) return null;
  var title = musicItem.title || '';
  var artist = musicItem.artist || '';
  if (!title) return null;

  var cacheKey = 'lrc_' + normText(title) + '|' + normText(artist);
  var cached = getCachedLyric('global', cacheKey);
  if (cached !== null) return { rawLrc: cached };

  try {
    var lrclib = await fetchLrclibLyric(title, artist);
    var lrc = resolveLrcResult(lrclib, musicItem);
    if (lrc) {
      setCachedLyric('global', cacheKey, lrc);
      return { rawLrc: lrc };
    }
  } catch (e) {}

  try {
    var lrclib2 = await fetchLrclibSearch(title, artist);
    var lrc2 = resolveLrcResult(lrclib2, musicItem);
    if (lrc2) {
      setCachedLyric('global', cacheKey, lrc2);
      return { rawLrc: lrc2 };
    }
  } catch (e) {}

  try {
    var lrclib3 = await fetchLrclibSearch(title, '');
    var lrc3 = resolveLrcResult(lrclib3, musicItem);
    if (lrc3) {
      setCachedLyric('global', cacheKey, lrc3);
      return { rawLrc: lrc3 };
    }
  } catch (e) {}

  var cleanTitle = stripVersionTag(title);
  if (cleanTitle && cleanTitle !== title) {
    try {
      var lrclib4 = await fetchLrclibLyric(cleanTitle, artist);
      var lrc4 = resolveLrcResult(lrclib4, musicItem);
      if (lrc4) {
        setCachedLyric('global', cacheKey, lrc4);
        return { rawLrc: lrc4 };
      }
    } catch (e) {}
    try {
      var lrclib5 = await fetchLrclibSearch(cleanTitle, artist);
      var lrc5 = resolveLrcResult(lrclib5, musicItem);
      if (lrc5) {
        setCachedLyric('global', cacheKey, lrc5);
        return { rawLrc: lrc5 };
      }
    } catch (e) {}
  }

  try {
    var kugou = await fetchKugouLyric(title, artist, musicItem.duration);
    if (kugou) {
      setCachedLyric('global', cacheKey, kugou);
      return { rawLrc: kugou };
    }
  } catch (e) {}

  try {
    var kugou2 = await fetchKugouLyric(cleanTitle || title, artist, musicItem.duration);
    if (kugou2) {
      setCachedLyric('global', cacheKey, kugou2);
      return { rawLrc: kugou2 };
    }
  } catch (e) {}

  return null;
}

module.exports = {
  platform: 'suibian',
  version: '0.3.2',
  author: 'wangqiao258',
  description: '多平台官方榜单无限随机播放，按歌名+歌手用bilibili搜索直接播放',
  srcUrl: '',
  cacheControl: 'no-cache',
  supportedSearchType: ['music'],
  search: search,
  getTopLists: getTopLists,
  getTopListDetail: getTopListDetail,
  getMediaSource: getMediaSource,
  getLyric: getLyric,
};

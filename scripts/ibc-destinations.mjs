// 받는 체인 목록 — dist/ibc-destinations.json 을 만든다(의존성 없음, Node 20+).
//
// 앱은 IBC 보내기의 «받는 체인» 후보를 이 파일에서 읽고, 채널은 노드에서 다시 확인한다(앱 ADR-033·ADR-035).
// Skip API 는 이 스크립트만 부른다 — 키(SKIP_API_KEY)가 있으면 authorization 헤더로, 없으면 키 없이(공용 한도).
// 앱에 키를 넣지 않고, Skip 호출 수가 앱 사용자 수와 무관하게 하기 위해서다.
//
// 묻는 토큰 = 출시 체인(cosmos/, order)의 기본·스테이킹 토큰과 currencies + registry.config.json ibcSources(앱 내장 XPLA).
// 1차 답에서 다른 출시 체인에 도착한 IBC 표기(ibc/…)를 그 체인의 출발 토큰으로 한 번 더 묻는다(되돌려보내기).
// 하나라도 끝내 실패하면 파일을 쓰지 않고 1 로 끝낸다 — 배포 작업이 이전 배포 파일을 다시 올린다(빈 목록으로 덮지 않는다).
//
// 형식(앱 파서와의 계약 — 바꾸면 앱이 버린다):
// { "version": 1, "generatedAt": ISO, "routes": { 출발 chainId: { 출발 denom: { 목적지 chainId: [목적지 denom…] } } } }

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LIMIT = 256 * 1024; // 앱 쪽 상한과 같다(registry.json 과 같은 값)
const ENDPOINT = 'https://api.skip.build/v2/fungible/assets_from_source';
const TIMEOUT = 20_000;
const ATTEMPTS = 4;
const CONCURRENCY = 4;
const KEY = process.env.SKIP_API_KEY?.trim() || undefined;

const config = JSON.parse(readFileSync(join(ROOT, 'registry.config.json'), 'utf8'));
const chains = readdirSync(join(ROOT, 'cosmos'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'cosmos', f), 'utf8')))
  .filter((c) => config.order.includes(c.id));

// CW20 은 bank 전송이 아니라 IBC 1홉 대상이 아니다(앱도 조회하지 않는다).
const bank = (denom) => typeof denom === 'string' && denom.length > 0 && denom.length <= 256 && !denom.startsWith('cw20:');

const sources = new Map(); // chainId → Set(denom)
function addSource(chainId, denom) {
  if (!bank(denom)) return false;
  if (!sources.has(chainId)) sources.set(chainId, new Set());
  const set = sources.get(chainId);
  if (set.has(denom)) return false;
  set.add(denom);
  return true;
}
for (const [chainId, denoms] of Object.entries(config.ibcSources ?? {})) for (const d of denoms) addSource(chainId, d);
for (const c of chains) {
  addSource(c.chainId, c.stakeCurrency?.denom);
  addSource(c.chainId, c.feeDenom);
  for (const cur of c.currencies ?? []) addSource(c.chainId, cur.denom);
}
const release = new Set(sources.keys());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ask(chainId, denom) {
  let last;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(KEY ? { authorization: KEY } : {}) },
        body: JSON.stringify({ source_asset_denom: denom, source_asset_chain_id: chainId, allow_multi_tx: false }),
        signal: controller.signal,
      });
      if (res.ok) {
        const body = await res.json();
        // 200 인데 dest_assets 가 없으면 응답 형식이 바뀐 것이다 — «받는 체인 없음» 으로 덮지 않고 실패로 본다.
        if (!body || typeof body.dest_assets !== 'object') throw new Error('dest_assets 없음');
        return body.dest_assets;
      }
      // Skip 이 모르는 토큰은 404 «route not found» 다 — 실패가 아니라 «받는 체인 없음».
      if (res.status === 404) return {};
      last = `HTTP ${res.status}`;
      if (res.status !== 429 && res.status < 500) break; // 요청 자체가 틀린 것 — 다시 물어도 같다
    } catch (e) {
      last = e.name === 'AbortError' ? 'timeout' : e.message;
    } finally {
      clearTimeout(timer);
    }
    await sleep(1000 * 2 ** attempt);
  }
  throw new Error(`${chainId} ${denom}: ${last}`);
}

const routes = {};
async function run(pairs) {
  const found = [];
  const queue = [...pairs];
  async function worker() {
    for (let pair = queue.shift(); pair; pair = queue.shift()) {
      const [chainId, denom] = pair;
      const dest = await ask(chainId, denom);
      const entry = {};
      for (const [destChainId, { assets = [] } = {}] of Object.entries(dest)) {
        if (destChainId === chainId || !release.has(destChainId)) continue;
        const denoms = [...new Set(assets.filter((a) => a.chain_id === destChainId && !a.is_cw20 && bank(a.denom)).map((a) => a.denom))].sort();
        if (denoms.length) {
          entry[destChainId] = denoms;
          for (const d of denoms) found.push([destChainId, d]);
        }
      }
      if (Object.keys(entry).length) (routes[chainId] ??= {})[denom] = entry;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return found;
}

const first = [...sources].flatMap(([chainId, set]) => [...set].map((d) => [chainId, d]));
const reverse = (await run(first)).filter(([chainId, denom]) => addSource(chainId, denom));
await run(reverse);

const out = JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), routes });
const count = Object.values(routes).reduce((n, byDenom) => n + Object.keys(byDenom).length, 0);
if (!count) throw new Error('받는 체인이 하나도 없다 — Skip 응답이 비정상이다');
if (Buffer.byteLength(out) > LIMIT) throw new Error(`ibc-destinations.json 이 ${LIMIT} 바이트를 넘는다`);
mkdirSync(join(ROOT, 'dist'), { recursive: true });
writeFileSync(join(ROOT, 'dist', 'ibc-destinations.json'), out);
console.log(`OK — ibc-destinations.json 출발 토큰 ${count}개 (질의 ${first.length + reverse.length}번, 키 ${KEY ? '있음' : '없음'}) ${Buffer.byteLength(out)} 바이트`);

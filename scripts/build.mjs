// 체인 파일을 검사하고 합쳐 두 파일을 만든다.
// - dist/registry.json: 출시 체인(cosmos/*.json, order) — 출시 빌드가 받는다.
// - dist/registry-testnet.json: 출시 체인 + 테스트넷(cosmos-testnet/*.json, testnetOrder) — 개발 빌드 전용.
// 규칙은 xPlayz 앱의 레지스트리 스키마(apps/mobile/src/lib/chains/registry/schema.ts)와 같다 —
// 앱도 받을 때 다시 검사해 틀린 항목을 버리지만, 여기서 먼저 막아 배포 파일에 들어가지 않게 한다.
// 의존성 없이 Node 20+ 로 돈다: `node scripts/build.mjs` (검사만: `node scripts/build.mjs --check`).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LIMIT = 256 * 1024; // 앱 CHAIN_REGISTRY_JSON_LIMIT
// 앱에 내장된 CONX 체인 — 레지스트리가 덮을 수 없다(앱이 버림).
const BUILTIN = { ids: ['xpla-mainnet', 'xpla-testnet'], chainIds: ['dimension_37-1', 'cube_47-5'] };
const KEYS = new Set([
  'id', 'chainId', 'name', 'bech32Prefix', 'coinType', 'keyType', 'pubKeyTypeUrl', 'feeDenom',
  'display', 'lcd', 'rpc', 'explorerTx', 'explorerAccount', 'features', 'stakeCurrency',
  'gasAdjustment', 'minGasPrice', 'testnet', 'txSearch', 'currencies',
]);
const REQUIRED = [
  'id', 'chainId', 'name', 'bech32Prefix', 'coinType', 'keyType', 'pubKeyTypeUrl', 'feeDenom',
  'display', 'lcd', 'explorerTx', 'explorerAccount', 'features', 'gasAdjustment', 'minGasPrice',
  'testnet',
];
const FEATURES = new Set(['cosmwasm', 'staking', 'cancel-unbonding', 'evm-min-gas-price']);

const text = (v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 512;
function https(v) {
  if (typeof v !== 'string' || v.length > 2048) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password;
  } catch {
    return false;
  }
}
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const display = (v) => !!v && typeof v === 'object' && text(v.symbol) && int(v.decimals, 0, 255);
const currency = (v) => display(v) && text(v.denom);
function gasPrice(v) {
  if (typeof v !== 'string' || v.length > 256 || !/^\d+(?:\.\d+)?$/.test(v)) return false;
  const [whole, fraction = ''] = v.split('.');
  const n = BigInt(whole);
  return n < 10n ** 14n || (n === 10n ** 14n && !/[1-9]/.test(fraction));
}

function check(chain, file) {
  const errors = [];
  const fail = (msg) => errors.push(`${file}: ${msg}`);
  if (!chain || typeof chain !== 'object' || Array.isArray(chain)) return [`${file}: 객체가 아니다`];
  for (const key of Object.keys(chain)) if (!KEYS.has(key)) fail(`모르는 필드 ${key}`);
  for (const key of REQUIRED) if (!(key in chain)) fail(`필수 필드 ${key} 없음`);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(chain.id ?? '')) fail('id 형식');
  if (`${chain.id}.json` !== file.split('/').pop()) fail('파일 이름이 id 와 다르다');
  for (const key of ['chainId', 'name', 'pubKeyTypeUrl', 'feeDenom']) if (!text(chain[key])) fail(`${key} 형식`);
  if (!/^[a-z0-9]{1,83}$/.test(chain.bech32Prefix ?? '')) fail('bech32Prefix 형식');
  if (!int(chain.coinType, 0, 2 ** 31 - 1)) fail('coinType 형식');
  if (!['eth_secp256k1', 'secp256k1'].includes(chain.keyType)) fail('keyType');
  if (!display(chain.display)) fail('display 형식');
  if (!https(chain.lcd)) fail('lcd 는 https');
  if ('rpc' in chain && !https(chain.rpc)) fail('rpc 는 https');
  if (!https(chain.explorerTx) || !chain.explorerTx.includes('${txHash}')) fail('explorerTx 에 ${txHash}');
  if (!https(chain.explorerAccount) || !chain.explorerAccount.includes('${accountAddress}'))
    fail('explorerAccount 에 ${accountAddress}');
  if (!Array.isArray(chain.features) || chain.features.some((f) => !FEATURES.has(f))) fail('features');
  if ('stakeCurrency' in chain && !currency(chain.stakeCurrency)) fail('stakeCurrency 형식');
  if (typeof chain.gasAdjustment !== 'number' || chain.gasAdjustment < 1 || chain.gasAdjustment > 3)
    fail('gasAdjustment 1~3');
  if (!gasPrice(chain.minGasPrice)) fail('minGasPrice 형식');
  if (chain.features?.includes('evm-min-gas-price') && !/^\d+$/.test(chain.minGasPrice ?? ''))
    fail('evm-min-gas-price 체인의 minGasPrice 는 정수');
  if (typeof chain.testnet !== 'boolean') fail('testnet 은 true/false');
  if ('txSearch' in chain) {
    const t = chain.txSearch;
    if (!t || !https(t.lcd) || !['query', 'events'].includes(t.param)) fail('txSearch 형식');
  }
  if ('currencies' in chain && (!Array.isArray(chain.currencies) || chain.currencies.length > 100 || !chain.currencies.every(currency)))
    fail('currencies 형식');
  if (BUILTIN.ids.includes(chain.id) || BUILTIN.chainIds.includes(chain.chainId)) fail('CONX 내장 체인은 넣을 수 없다');
  return errors;
}

const config = JSON.parse(readFileSync(join(ROOT, 'registry.config.json'), 'utf8'));
const errors = [];

// 한 묶음(폴더 + 순서 키)을 검사하고 순서대로 돌려준다. 폴더가 정한 testnet 값과 파일 값이 같아야 한다.
function load(dir, orderKey, testnet) {
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.json')).sort();
  const byId = new Map();
  for (const file of files) {
    const path = `${dir}/${file}`;
    let chain;
    try {
      chain = JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
    } catch (e) {
      errors.push(`${path}: JSON 이 아니다 (${e.message})`);
      continue;
    }
    errors.push(...check(chain, path));
    if (typeof chain.testnet === 'boolean' && chain.testnet !== testnet) errors.push(`${path}: ${dir}/ 의 체인은 testnet ${testnet}`);
    byId.set(chain.id, chain);
  }
  const order = config[orderKey] ?? [];
  for (const id of order) if (!byId.has(id)) errors.push(`registry.config.json: ${orderKey} 의 ${id} 파일이 없다`);
  for (const id of byId.keys()) if (!order.includes(id)) errors.push(`registry.config.json: ${id} 가 ${orderKey} 에 없다`);
  if (new Set(order).size !== order.length) errors.push(`registry.config.json: ${orderKey} 에 같은 id 가 두 번`);
  return order.map((id) => byId.get(id)).filter(Boolean);
}

const mainnet = load('cosmos', 'order', false);
const testnets = load('cosmos-testnet', 'testnetOrder', true);
// 테스트넷 파일은 두 묶음을 합치므로 id·chainId 는 묶음을 넘어서도 겹치면 안 된다(앱이 뒤의 것을 버린다).
const all = [...mainnet, ...testnets];
if (new Set(all.map((c) => c.id)).size !== all.length) errors.push('같은 id 가 두 파일에');
if (new Set(all.map((c) => c.chainId)).size !== all.length) errors.push('같은 chainId 가 두 파일에');
if (config.version !== 1 || !text(config.source)) errors.push('registry.config.json: version 1 · source');

// 출시 빌드는 registry.json 만, 개발 빌드는 registry-testnet.json 을 받는다. 256KB 제한은 파일마다다.
const outputs = [
  ['registry.json', mainnet],
  ['registry-testnet.json', all],
].map(([name, chains]) => ({ name, count: chains.length, out: JSON.stringify({ version: 1, source: config.source, chains }) }));
for (const { name, out } of outputs) if (Buffer.byteLength(out) > LIMIT) errors.push(`${name} 이 ${LIMIT} 바이트를 넘는다`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
if (!process.argv.includes('--check')) {
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  for (const { name, out } of outputs) writeFileSync(join(ROOT, 'dist', name), out);
  writeFileSync(join(ROOT, 'dist/index.html'), '<!doctype html><meta charset="utf-8"><title>xPlayz chain registry</title><p><a href="registry.json">registry.json</a></p><p><a href="registry-testnet.json">registry-testnet.json</a></p>\n');
}
console.log(`OK — ${outputs.map(({ name, count, out }) => `${name} 체인 ${count}개 ${Buffer.byteLength(out)} 바이트`).join(' · ')}`);

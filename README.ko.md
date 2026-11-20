# xPlayz 체인 레지스트리

[English](README.md) · **한국어**

xPlayz 지갑 앱(`zenaaddev/xplayz`)이 «다른 체인» 목록으로 받는 Cosmos 체인 정보다. 체인 하나가 JSON 파일 하나이고, `main` 에 들어오면 검사해 합친 뒤 받는 체인 목록(IBC)과 함께 GitHub Pages 로 배포한다.

## 목차

- [개요](#개요)
  - [배포 파일](#배포-파일)
  - [앱이 쓰는 방식](#앱이-쓰는-방식)
  - [넣지 않는 것](#넣지-않는-것)
- [준비 사항](#준비-사항)
- [디렉터리 구조](#디렉터리-구조)
- [체인 파일 형식](#체인-파일-형식)
  - [예시](#예시)
  - [필드별 요구사항](#필드별-요구사항)
  - [토큰 객체](#토큰-객체)
  - [`features` 값](#features-값)
  - [`currencies` 의 역할](#currencies-의-역할)
  - [레지스트리 전체 규칙](#레지스트리-전체-규칙)
- [registry.config.json](#registryconfigjson)
- [IBC 받는 체인 목록](#ibc-받는-체인-목록)
  - [형식](#형식)
  - [만드는 방식](#만드는-방식)
  - [실행 시점과 실패 처리](#실행-시점과-실패-처리)
  - [Skip API 키](#skip-api-키)
  - [공개 저장소의 예약 실행](#공개-저장소의-예약-실행)
- [로컬 검사](#로컬-검사)
- [체인 추가와 수정](#체인-추가와-수정)
  - [절차](#절차)
  - [PR 체크리스트](#pr-체크리스트)
- [CI 와 배포](#ci-와-배포)
- [출처와 라이선스](#출처와-라이선스)

## 개요

### 배포 파일

| 파일 | 주소 | 쓰는 곳 | 내용 |
| --- | --- | --- | --- |
| `registry.json` | `https://zenaaddev.github.io/xplayz-chain-registry/registry.json` | 출시 빌드(이 주소를 넣은 개발 빌드 포함) | 출시 체인 — `cosmos/`, `order` 순서 |
| `registry-testnet.json` | `https://zenaaddev.github.io/xplayz-chain-registry/registry-testnet.json` | **개발 빌드 전용** | `registry.json` 의 출시 체인 전부 + 그 뒤에 테스트넷(`cosmos-testnet/`, `testnetOrder` 순서). `version`·`source` 는 `registry.json` 과 같다 |
| `ibc-destinations.json` | `https://zenaaddev.github.io/xplayz-chain-registry/ibc-destinations.json` | IBC 보내기(«받는 체인» 후보) | 출시 체인(앱 내장 XPLA 메인넷 + `registry.json` 체인)의 알려진 토큰마다 1홉으로 보낼 수 있는 출시 체인과 그 체인에서의 denom |

Pages 첫 화면(`index.html`)에는 세 파일 링크가 있다.

### 앱이 쓰는 방식

- 앱은 `EXPO_PUBLIC_CHAIN_REGISTRY_URL` 에서 레지스트리 주소를 읽는다. **출시 빌드는 `registry.json` 만 쓴다.** 개발 빌드만 여기에 `registry-testnet.json` 주소를 넣는다.
- 앱은 받은 파일을 캐시하고, 받지 못하면 캐시나 앱에 내장된 사본(출시 시점)으로 돈다.
- 앱은 받은 파일을 레지스트리 스키마(`apps/mobile/src/lib/chains/registry/schema.ts`)로 다시 검사해 틀린 항목을 버린다. `scripts/build.mjs` 가 같은 규칙으로 먼저 막으므로 틀린 항목은 배포 파일에 들어가지 않는다.
- 앱은 레지스트리 주소가 `https` 이고, 사용자 이름·비밀번호가 없고, `raw.githubusercontent.com` 이 아닐 때만 받는다.
- **테스트넷 파일이 있는 이유:** 해제 취소·거래 검색 히스토리 같은 앱 기능을 테스트넷에서 실거래로 확인하기 위해서다. «체인 추가» 로 넣은 사용자 체인은 `features`·`txSearch` 를 넣을 칸이 없어 이 확인이 안 된다. 그래서 테스트넷도 메인넷과 같은 기준의 체인 정보로 여기서 받는다.
- **받는 체인 목록:** 앱은 IBC 보내기의 «받는 체인» 후보를 `ibc-destinations.json` 에서 읽고, 채널은 노드에서 다시 확인한다. 목록은 후보만 준다.

### 넣지 않는 것

- **CONX 메인넷·테스트넷**(`xpla-mainnet` / `dimension_37-1`, `xpla-testnet` / `cube_47-5`). 앱에 내장된 정본이다. `build.mjs` 가 막고, 넣더라도 앱이 버린다.
- **체인 로고.** 이 저장소가 아니라 앱에 들어 있다.
- **표시 목적으로 손으로 넣는 받은 IBC 토큰 표기.** [`currencies` 의 역할](#currencies-의-역할)을 본다.
- **비밀값**(Skip API 키 등). [Skip API 키](#skip-api-키)를 본다.

## 준비 사항

- **Node.js 20 이상.** 스크립트에 의존성이 없어 `npm install` 이 필요 없다. CI 는 Node 22 로 돈다.
- **원본 값:** 체인 값은 [cosmos/chain-registry](https://github.com/cosmos/chain-registry)(테스트넷은 `testnets/`)에서 가져와 아래 형식으로 옮긴다. [필드 목록](#필드별-요구사항)에 없는 필드는 뺀다.
- **노드:** 공개 노드를 쓰고, 넣기 전에 실제로 불러 본다(잔액 조회·거래 검색).
- **주소에 영향을 주는 변경**(`id`·`bech32Prefix`·`coinType`·`keyType`)은 앱 쪽 검토가 필요하다. [체인 추가와 수정](#체인-추가와-수정)의 경고를 본다.
- `main` 에 머지하면 바로 배포된다. 앱은 다음 실행 때 받는다.

## 디렉터리 구조

```
.
├── cosmos/                       # 출시 체인, 체인 하나가 파일 하나: <id>.json, "testnet": false
│   ├── cosmoshub.json
│   ├── injective.json
│   └── osmosis.json
├── cosmos-testnet/               # 테스트넷 체인, 체인 하나가 파일 하나: <id>.json, "testnet": true
│   ├── cosmoshub-testnet.json
│   ├── injective-testnet.json
│   └── osmosis-testnet.json
├── registry.config.json          # version, source, 체인 순서(order / testnetOrder), 더 물을 IBC 출발 토큰(ibcSources)
├── scripts/
│   ├── build.mjs                 # 검사 + 합치기 → dist/registry.json, dist/registry-testnet.json, dist/index.html
│   └── ibc-destinations.mjs      # 받는 체인 목록 → dist/ibc-destinations.json (Skip API 호출)
├── .github/workflows/pages.yml   # PR: 검사만. main·예약·수동 실행: 검사 → 받는 체인 목록 → dist/ 를 Pages 배포
└── dist/                         # 빌드 결과(git 에서 제외)
```

## 체인 파일 형식

체인 파일은 앱의 레지스트리 스키마(`apps/mobile/src/lib/chains/registry/schema.ts`)를 따른다. 아래 목록에 없는 필드가 있으면 검사에서 막힌다.

### 예시

작성 시점의 `cosmos/cosmoshub.json` 이다. 정본은 `cosmos/` 의 파일이다.

```json
{
  "id": "cosmoshub",
  "chainId": "cosmoshub-4",
  "name": "Cosmos Hub",
  "bech32Prefix": "cosmos",
  "coinType": 118,
  "keyType": "secp256k1",
  "feeDenom": "uatom",
  "display": {
    "symbol": "ATOM",
    "decimals": 6
  },
  "lcd": "https://cosmos-rest.publicnode.com",
  "explorerTx": "https://www.mintscan.io/cosmos/transactions/${txHash}",
  "explorerAccount": "https://www.mintscan.io/cosmos/accounts/${accountAddress}",
  "pubKeyTypeUrl": "/cosmos.crypto.secp256k1.PubKey",
  "rpc": "https://cosmos-rpc.publicnode.com",
  "features": [
    "cosmwasm",
    "staking",
    "cancel-unbonding"
  ],
  "stakeCurrency": {
    "denom": "uatom",
    "symbol": "ATOM",
    "decimals": 6
  },
  "gasAdjustment": 1.3,
  "minGasPrice": "0.025",
  "testnet": false,
  "txSearch": {
    "lcd": "https://cosmos-rest.publicnode.com",
    "param": "query"
  },
  "currencies": [
    {
      "denom": "uatom",
      "symbol": "ATOM",
      "decimals": 6
    },
    {
      "denom": "ibc/F04D72CF9B5D9C849BB278B691CDFA2241813327430EC9CDC83F8F4CA4CDC2B0",
      "symbol": "USDt",
      "decimals": 6
    },
    {
      "denom": "ibc/B26F762ED6D20D0D5305FE1870A476EBCB95127C10199F3CB16E69D893E9F775",
      "symbol": "OPHIR",
      "decimals": 6
    },
    {
      "denom": "ibc/7B6EBFC446E50DFF981C994E207BFB398889706C2B0DF8A14D8B87F6C0E33A1A",
      "symbol": "QUARK",
      "decimals": 6
    },
    {
      "denom": "factory/cosmos1wdja2gcsesyl07raq9jm3rcvu0sse5zkev0h8m/Nether",
      "symbol": "NTHR",
      "decimals": 6
    },
    {
      "denom": "factory/cosmos1s8qx0zvz8yd6e4x0mqmqf7fr9vvfn6226hkvrq/ustars",
      "symbol": "STARS",
      "decimals": 6
    },
    {
      "denom": "factory/cosmos146s5j3t7gh2g37ywm47dp8avhesu2htvjjaxq7z55e7xj0rq0k8q5qnjjy/PHMN",
      "symbol": "PHMN",
      "decimals": 6
    },
    {
      "denom": "factory/cosmos1nxxz937qd6zqxllwplydy6hts97c4amaqj8jxa57nsme3dmckk4s3mqujr/RESP",
      "symbol": "RESP",
      "decimals": 6
    },
    {
      "denom": "factory/cosmos1w9ee57gnduzm4l9h6xwn9tee9pyh8wlr4r9r35/art",
      "symbol": "ART",
      "decimals": 6
    },
    {
      "denom": "ibc/E107DB3E8AABB49C87CB737A1ABBFDBA9803ECAE05E295D8D7A0B1A7FE83706C",
      "symbol": "USDC.inj",
      "decimals": 6
    },
    {
      "denom": "factory/cosmos1czdq25vuxw64gcj3lwvl3z93l76d92y7nys9u2/cinn",
      "symbol": "CINN",
      "decimals": 6
    }
  ]
}
```

### 필드별 요구사항

아래 제약은 `scripts/build.mjs` 가 검사하는 그대로다. «텍스트» 는 앞뒤 공백을 뺀 길이가 1~512자인 문자열이다. «HTTPS 주소» 는 2048자 이하, `https:` 방식, 호스트가 있고 사용자 이름·비밀번호가 없는 URL 이다.

| 필드 | 필수 | 형식과 제약 | 예 | 뜻 |
| --- | --- | --- | --- | --- |
| `id` | 예 | `^[a-z0-9][a-z0-9-]{0,63}$`. 파일 이름에서 `.json` 을 뺀 것과 같아야 한다. `xpla-mainnet`·`xpla-testnet` 은 안 된다 | `cosmoshub` | 앱 안 id. 🔴 바꾸면 사용자의 «켠 체인» 기록이 끊긴다 |
| `chainId` | 예 | 텍스트. `dimension_37-1`·`cube_47-5` 는 안 된다 | `cosmoshub-4` | 체인 ID |
| `name` | 예 | 텍스트 | `Cosmos Hub` | 표시 이름 |
| `bech32Prefix` | 예 | `^[a-z0-9]{1,83}$` | `cosmos` | 주소 접두어. 🔴 바꾸면 사용자 주소가 바뀐다 |
| `coinType` | 예 | 정수, 0 ~ 2147483647(2³¹ − 1) | `118` | BIP-44 코인 타입. 🔴 바꾸면 사용자 주소가 바뀐다 |
| `keyType` | 예 | `secp256k1` 또는 `eth_secp256k1` | `secp256k1` | 키 방식. 🔴 바꾸면 사용자 주소가 바뀐다 |
| `pubKeyTypeUrl` | 예 | 텍스트 | `/cosmos.crypto.secp256k1.PubKey` (Injective: `/injective.crypto.v1beta1.ethsecp256k1.PubKey`) | 키 방식의 공개키 타입 |
| `feeDenom` | 예 | 텍스트 | `uatom` | 수수료 토큰 |
| `display` | 예 | `{ symbol, decimals }`, [토큰 객체](#토큰-객체) 참고 | `{ "symbol": "ATOM", "decimals": 6 }` | 네이티브 토큰 표시 |
| `lcd` | 예 | HTTPS 주소 | `https://cosmos-rest.publicnode.com` | REST(LCD) 노드 |
| `rpc` | 아니오 | HTTPS 주소 | `https://cosmos-rpc.publicnode.com` | RPC 노드 |
| `explorerTx` | 예 | `${txHash}` 문자열이 들어간 HTTPS 주소 | `https://www.mintscan.io/cosmos/transactions/${txHash}` | 탐색기 거래 페이지 |
| `explorerAccount` | 예 | `${accountAddress}` 문자열이 들어간 HTTPS 주소 | `https://www.mintscan.io/cosmos/accounts/${accountAddress}` | 탐색기 계정 페이지 |
| `features` | 예 | `cosmwasm`·`staking`·`cancel-unbonding`·`evm-min-gas-price` 의 배열(비어도 된다) | `["cosmwasm", "staking", "cancel-unbonding"]` | [`features` 값](#features-값) 참고 |
| `stakeCurrency` | 아니오 | `{ denom, symbol, decimals }`, [토큰 객체](#토큰-객체) 참고 | `{ "denom": "uatom", "symbol": "ATOM", "decimals": 6 }` | 스테이킹 토큰 |
| `gasAdjustment` | 예 | 숫자, 1 이상 3 이하 | `1.3` | 가스 배율 |
| `minGasPrice` | 예 | `^\d+(\.\d+)?$` 인 소수 **문자열**, 256자 이하, 값은 10¹⁴ 이하. `evm-min-gas-price` 체인이면 정수 문자열만 | `"0.025"` | `feeDenom` 기준 최소 가스 가격 |
| `testnet` | 예 | `true` 또는 `false`. `cosmos/` 는 `false`, `cosmos-testnet/` 은 `true` 여야 한다 | `false` | 테스트넷 여부 |
| `txSearch` | 아니오 | `{ lcd: HTTPS 주소, param: "query" 또는 "events" }` | `{ "lcd": "https://cosmos-rest.publicnode.com", "param": "query" }` | 거래 검색 노드와 파라미터. 없으면 앱이 그 체인의 거래 히스토리를 보여 주지 않는다 |
| `currencies` | 아니오 | `{ denom, symbol, decimals }` 의 배열, **100개**까지 | 예시 참고 | 알려진 토큰, [`currencies` 의 역할](#currencies-의-역할) 참고 |

**`txSearch.param`:** 앱은 `GET {txSearch.lcd}/cosmos/tx/v1beta1/txs?{param}=message.sender='<주소>'`(과 `transfer.recipient`)로 부른다. `query` 파라미터를 받는 노드(Cosmos SDK v0.50 이상)는 `query`, 그보다 오래된 노드는 `events` 를 쓴다. 노드에서 실제로 검색해 보고 정한다.

### 토큰 객체

| 객체 | 필드 |
| --- | --- |
| `display` | `symbol`: 텍스트. `decimals`: 정수 0 ~ 255 |
| `stakeCurrency`, `currencies` 의 각 항목 | `denom`: 텍스트. `symbol`: 텍스트. `decimals`: 정수 0 ~ 255 |

### `features` 값

| 값 | 앱이 하는 일 |
| --- | --- |
| `cosmwasm` | 그 체인에서 CosmWasm 기능(NFT 컬렉션)을 켠다. 체인이 wasm 모듈을 운영할 때 넣는다(예: LCD 가 `/cosmwasm/wasm/v1/code` 에 답한다) |
| `staking` | 그 체인의 스테이킹(검증인, 위임 등)을 보여 준다 |
| `cancel-unbonding` | 해제 중인 위임의 취소(재위임)를 제공한다 |
| `evm-min-gas-price` | LCD 의 `/cosmos/evm/vm/v1/min_gas_price` 에서 최소 가스 가격을 읽어 정수로 올려 쓰고, 그 호출이 실패하면 `minGasPrice` 를 쓴다. 노드 값이 `minGasPrice` 의 10배를 넘으면 보내기를 거부한다. `minGasPrice` 는 정수 문자열이어야 한다 |

### `currencies` 의 역할

- **알려진 토큰.** 그 체인이 아는 토큰과 기호·자릿수다.
- **IBC 보내기 출발 토큰.** `scripts/ibc-destinations.mjs` 가 `currencies` 의 denom 전부(와 `feeDenom`·`stakeCurrency`)를 Skip 에 물어 `ibc-destinations.json` 을 만든다. **토큰을 IBC 후보에 넣으려면 `currencies` 에 더하는 PR 을 올린다.** 머지되면 그 배포에 포함된다.
- **받은 IBC 토큰 표기(`ibc/…`)를 앱에 이름·자릿수를 보이려는 목적만으로 손으로 넣지 않는다.** 앱은 받은 IBC 토큰의 denom trace 를 따라 출처 체인을 찾아 푼다. 다른 출시 체인에서 도착한 토큰의 되돌려보내기 경로는 `currencies` 에 없어도 만들어진다([만드는 방식](#만드는-방식) 참고).
- 체인마다 100개까지다.

### 레지스트리 전체 규칙

`scripts/build.mjs` 는 파일을 넘어서 다음도 검사한다.

- 모든 파일은 JSON 객체이고, 필수 필드가 다 있고, 모르는 필드가 없다.
- 파일 이름은 `<id>.json` 이고, `testnet` 은 폴더와 맞다(`cosmos/` → `false`, `cosmos-testnet/` → `true`).
- `cosmos/` 의 모든 파일이 `order` 에 있고, `order` 의 모든 id 에 파일이 있고, 같은 id 가 두 번 나오지 않는다. `cosmos-testnet/` 과 `testnetOrder` 도 같다.
- `id`·`chainId` 는 두 폴더를 통틀어 겹치면 안 된다. `registry-testnet.json` 이 둘을 합치기 때문이다(겹치면 앱이 뒤의 것을 버린다).
- CONX 내장 체인(`xpla-mainnet`·`xpla-testnet`·`dimension_37-1`·`cube_47-5`)은 막는다.
- 배포 파일은 파일마다 256KB(262,144 바이트)를 넘을 수 없다 — 앱의 `CHAIN_REGISTRY_JSON_LIMIT`. `registry.json`·`registry-testnet.json` 을 따로 재고, `ibc-destinations.json` 도 같은 상한이다.
- `registry.config.json` 의 `version` 은 `1`, `source` 는 텍스트여야 한다.

## registry.config.json

```json
{
  "version": 1,
  "source": "cosmos/chain-registry (CC BY 4.0)",
  "order": ["cosmoshub", "osmosis", "injective"],
  "testnetOrder": ["cosmoshub-testnet", "osmosis-testnet", "injective-testnet"],
  "ibcSources": {
    "dimension_37-1": ["axpla"]
  }
}
```

| 필드 | 뜻 |
| --- | --- |
| `version` | `1` 이어야 한다. 두 레지스트리 파일에 그대로 들어간다 |
| `source` | 출처 표기. 두 레지스트리 파일에 그대로 들어간다 |
| `order` | 출시 체인 id 를 `registry.json` 에 나올 순서대로. `cosmos/` 의 파일과 정확히 맞아야 한다 |
| `testnetOrder` | 테스트넷 체인 id 순서. `registry-testnet.json` 에서 출시 체인 뒤에 온다. `cosmos-testnet/` 의 파일과 정확히 맞아야 한다 |
| `ibcSources` | 받는 체인 목록에서 더 물을 출발 토큰: `{ chainId: [denom, …] }`. 여기에 파일이 없는 앱 내장 XPLA 메인넷을 넣는다 |

## IBC 받는 체인 목록

### 형식

`ibc-destinations.json` 은 앱 파서와의 계약이다(앱 ADR-035).

```json
{
  "version": 1,
  "generatedAt": "2026-11-19T14:56:33.766Z",
  "routes": {
    "<출발 chainId>": {
      "<출발 denom>": {
        "<목적지 chainId>": ["<목적지 denom>", "…"]
      }
    }
  }
}
```

예: `routes["dimension_37-1"]["axpla"]` 는 `{ "cosmoshub-4": ["ibc/102A112CAEE6E503721048E5B2221252E40ABAB8B4344680E28F17BEAC9F9FB1"], "osmosis-1": ["ibc/95C9B5870F95E21A242E6AF9ADCB1F212EE4A8855087226C36FBE43FC41A77B8"] }` 이다.

🔴 앱은 읽지 못하는 파일을 버린다. 형식을 바꾸려면 앱 쪽과 먼저 맞춘다. 파일은 256KB 까지다.

### 만드는 방식

`scripts/ibc-destinations.mjs` 가 Skip API(`POST https://api.skip.build/v2/fungible/assets_from_source`, `allow_multi_tx: false`)에 묻는다.

1. **출발 토큰:** 출시 체인(`cosmos/`, `order`)마다 `feeDenom`·`stakeCurrency`·`currencies` 의 denom 전부 + `registry.config.json` 의 `ibcSources`(앱 내장 XPLA). CW20 토큰(`cw20:`)은 뺀다.
2. **목적지:** 다른 출시 체인만, bank denom 만(CW20 제외), 중복을 빼고 정렬한다.
3. **되돌려보내기:** 1차 답에서 다른 출시 체인에 도착한 IBC 표기(`ibc/…`)를 그 체인의 출발 토큰으로 한 번 더 묻는다.
4. **재시도:** 질의마다 4번까지(20초 제한 시간, 시도 사이 대기 시간을 늘림, 동시에 4개). 404(«route not found»)는 실패가 아니라 «받는 체인 없음» 이다. 429·5xx·시간 초과는 다시 묻고, 그 밖의 4xx 는 다시 묻지 않는다.
5. **전부 아니면 전무:** 질의 하나라도 끝내 실패하거나, 200 응답에 `dest_assets` 가 없거나, 경로가 하나도 없거나, 파일이 256KB 를 넘으면 아무것도 쓰지 않고 1 로 끝낸다.

### 실행 시점과 실패 처리

- `main` 머지 때마다, 하루 한 번 03:17 UTC(12:17 KST), 수동 실행(Actions → `registry` → Run workflow). PR 은 검사만 한다.
- 스크립트가 실패하면 새 파일을 쓰지 않고 지금 배포된 `ibc-destinations.json` 을 다시 올린다(빈·일부 목록으로 덮지 않는다). 배포 뒤 `stale` 작업이 그 실행을 실패로 끝내 알림이 가게 한다.
- 아직 배포된 파일이 없으면(첫 배포) build 작업이 실패하고 지금 배포가 남는다.

### Skip API 키

저장소 비밀값 `SKIP_API_KEY` 가 있으면 `authorization` 헤더로 보내고, 없으면 키 없이(공용 한도) 부른다. **키는 이 저장소 비밀값에만 둔다** — 앱·코드·문서에 넣지 않는다. Skip 은 이 스크립트만 부르므로 앱에는 키가 필요 없고, Skip 호출 수가 앱 사용자 수에 따라 늘지 않는다.

### 공개 저장소의 예약 실행

🔴 공개 저장소의 예약 실행은 저장소에 60일 동안 활동이 없으면 GitHub 가 끈다. 꺼지면 Actions 탭에서 `registry` 작업을 다시 켠다(Enable workflow). 꺼져 있어도 앱은 마지막 배포 파일·캐시·내장 사본으로 돈다.

## 로컬 검사

```sh
# 검사만 한다. PR 전에 매번 돌린다.
node scripts/build.mjs --check

# 검사 후 dist/registry.json, dist/registry-testnet.json, dist/index.html 을 쓴다(CI 가 이 형태로 돈다)
node scripts/build.mjs

# IBC 스크립트 문법 검사(CI 가 PR 에서도 돈다)
node --check scripts/ibc-destinations.mjs

# 선택: dist/ibc-destinations.json 을 로컬에서 만든다. 키 없이 Skip API 를 부른다(공용 한도)
node scripts/ibc-destinations.mjs
```

`build.mjs` 는 성공하면 파일마다 체인 수·바이트를 적은 `OK —` 로 시작하는 한 줄을 찍고 0 으로 끝난다. 실패하면 문제마다 `<파일>: <이유>` 한 줄을 찍고 1 로 끝난다.

## 체인 추가와 수정

### 절차

1. `main` 에서 브랜치를 만든다.
2. `cosmos/<id>.json`(테스트넷은 `cosmos-testnet/<id>.json`)을 더하거나 고친다. 새 체인이면 `registry.config.json` 의 `order`(테스트넷은 `testnetOrder`)에 넣는다. 넣은 자리가 표시 순서다.
3. `node scripts/build.mjs --check` 로 검사한다.
4. `main` 대상 PR 을 연다 — CI 가 같은 검사(`build`)를 돈다. 노드는 공개 노드를 실제로 불러 보고(잔액·거래 검색) 넣는다.
5. 머지되면 배포된다. 앱은 다음 실행 때 받는다.

> 🔴 **`id`·`bech32Prefix`·`coinType`·`keyType` 을 바꾸는 PR 은 사용자 주소·켠 체인에 영향을 준다.** 앱 쪽 검토와 함께 한다.

### PR 체크리스트

- [ ] `node scripts/build.mjs --check` 가 통과한다.
- [ ] 파일 이름이 `id` 와 같고, `testnet` 이 폴더와 맞다.
- [ ] 새 체인을 `order`(또는 `testnetOrder`)에 넣었다.
- [ ] `lcd`·`rpc`·`txSearch.lcd` 가 실제 잔액 조회·거래 검색에 답한 공개 HTTPS 노드다.
- [ ] `explorerTx`·`explorerAccount` 에 `${txHash}`·`${accountAddress}` 가 있다.
- [ ] `currencies` 가 100개 이하이고, 표시 목적만으로 넣은 받은 IBC 토큰 표기가 없다.
- [ ] `id`·`bech32Prefix`·`coinType`·`keyType` 변경은 앱 쪽 검토를 받았다.
- [ ] 파일·커밋·PR 에 비밀값(Skip API 키 등)이 없다.
- [ ] PR 의 `build` 검사가 통과한다.

## CI 와 배포

`.github/workflows/pages.yml`(작업 이름 `registry`, Node 22):

| 계기 | `build` | `deploy` | `stale` |
| --- | --- | --- | --- |
| PR | `node scripts/build.mjs`, `node --check scripts/ibc-destinations.mjs` | — | — |
| `main` push, 예약(03:17 UTC), 수동 실행 | 위와 같음 → `node scripts/ibc-destinations.mjs`(실패하면 배포된 파일을 다시 올림) → `dist/` 업로드 | GitHub Pages 배포 | 받는 체인 목록을 이전 파일 그대로 다시 올렸으면 배포 뒤 실행을 실패로 끝냄 |

실행은 `pages` 동시 실행 그룹을 함께 쓰고, 새 실행이 와도 진행 중인 실행을 취소하지 않는다.

## 출처와 라이선스

체인 값은 [cosmos/chain-registry](https://github.com/cosmos/chain-registry)([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — 테스트넷은 `testnets/`)에서 가져와 xPlayz 형식으로 옮기고 일부를 고쳤다(노드 주소는 공개 노드를 실측해 골랐고, 쓰지 않는 필드는 뺐다). 체인 로고는 이 저장소에 없다 — 앱에 들어 있다.

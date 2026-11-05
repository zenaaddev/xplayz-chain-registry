# xPlayz chain registry

xPlayz 지갑 앱(`zenaaddev/xplayz`)이 «다른 체인» 목록으로 받는 Cosmos 체인 정보다. 체인 하나가 파일 하나이고, main 에 들어오면 하나로 합쳐 GitHub Pages 로 배포한다.

- 배포 주소: `https://zenaaddev.github.io/xplayz-chain-registry/registry.json`
- 앱 설정: `EXPO_PUBLIC_CHAIN_REGISTRY_URL` 에 위 주소를 넣는다. 앱은 이 파일을 받아 캐시하고, 받지 못하면 캐시나 앱에 내장된 사본(출시 시점)으로 돈다.
- CONX 메인넷·테스트넷은 앱에 내장된 정본이라 여기에 넣지 않는다(넣어도 앱이 버린다).

## 구조

| 경로 | 내용 |
| --- | --- |
| `cosmos/<id>.json` | 체인 하나. 파일 이름 = `id` |
| `registry.config.json` | 합친 파일의 `version`·`source`, 체인 순서 `order`(앱 «다른 체인» 목록 순서) |
| `scripts/build.mjs` | 검사 + 합치기(의존성 없음, Node 20+) |
| `.github/workflows/pages.yml` | PR 은 검사만, main 은 검사 → Pages 배포 |

## 체인 파일 형식

앱의 레지스트리 스키마(`apps/mobile/src/lib/chains/registry/schema.ts`)와 같다. 허용 필드 밖은 검사에서 막는다.

| 필드 | 뜻 |
| --- | --- |
| `id` | 앱 안 id(`^[a-z0-9][a-z0-9-]{0,63}$`) — 바꾸면 사용자의 «켠 체인» 기록이 끊긴다 |
| `chainId`·`name` | 체인 ID·표시 이름 |
| `bech32Prefix`·`coinType`·`keyType`·`pubKeyTypeUrl` | 주소·키 방식(`secp256k1` / `eth_secp256k1`) — 바꾸면 사용자 주소가 바뀐다 |
| `feeDenom`·`minGasPrice`·`gasAdjustment` | 수수료 토큰·최소 가스 가격(소수 문자열)·가스 배율(1~3) |
| `display`·`stakeCurrency`·`currencies` | 네이티브 토큰 표시·스테이킹 토큰·알려진 토큰(기호·자릿수, 100개까지) |
| `lcd`·`rpc`·`txSearch` | 노드 주소(https 만, `raw.githubusercontent.com` 금지) · 거래 검색 노드와 파라미터(`query`/`events`) |
| `explorerTx`·`explorerAccount` | 탐색기 형식 — `${txHash}`·`${accountAddress}` 자리 |
| `features` | `cosmwasm`·`staking`·`cancel-unbonding`·`evm-min-gas-price` |
| `testnet` | 테스트넷이면 `true` |

합친 파일은 256KB 를 넘을 수 없다.

## 체인 더하기·고치기

1. 브랜치에서 `cosmos/<id>.json` 을 더하거나 고치고, 새 체인이면 `registry.config.json` 의 `order` 에 넣는다.
2. `node scripts/build.mjs --check` 로 검사한다.
3. PR 을 연다 — CI 가 같은 검사를 돈다. 노드는 공개 노드를 실제로 불러 보고(잔액·거래 검색) 넣는다.
4. main 에 들어오면 배포된다. 앱은 다음 실행 때 받는다.

🔴 `id`·`bech32Prefix`·`coinType`·`keyType` 을 바꾸는 PR 은 사용자 주소·켠 체인에 영향을 준다 — 앱 쪽 검토와 함께 한다.

## 출처

체인 값은 [cosmos/chain-registry](https://github.com/cosmos/chain-registry)([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))에서 가져와 xPlayz 형식으로 옮기고 일부를 고쳤다(노드 주소는 공개 노드를 실측해 골랐고, 쓰지 않는 필드는 뺐다). 체인 로고는 이 저장소에 없다 — 앱에 들어 있다.

# xPlayz Chain Registry

**English** · [한국어](README.ko.md)

This repository holds the Cosmos chains that the xPlayz wallet app (`zenaaddev/xplayz`) offers in its «Other chains» list. Each chain is one JSON file. When a change lands on `main`, the files are validated, merged, and published to GitHub Pages together with the IBC destination list.

## Table of Contents

- [Overview](#overview)
  - [Published Files](#published-files)
  - [How the App Uses Them](#how-the-app-uses-them)
  - [What Does Not Belong Here](#what-does-not-belong-here)
- [Requirements and Preparation](#requirements-and-preparation)
- [Directory Structure](#directory-structure)
- [Chain File Format](#chain-file-format)
  - [Example](#example)
  - [Field Requirements](#field-requirements)
  - [Token Objects](#token-objects)
  - [Features](#features)
  - [The Role of `currencies`](#the-role-of-currencies)
  - [Registry-wide Rules](#registry-wide-rules)
- [registry.config.json](#registryconfigjson)
- [IBC Destination List](#ibc-destination-list)
  - [Format](#format)
  - [How It Is Generated](#how-it-is-generated)
  - [When It Runs and What Happens on Failure](#when-it-runs-and-what-happens-on-failure)
  - [Skip API Key](#skip-api-key)
  - [Scheduled Runs on a Public Repository](#scheduled-runs-on-a-public-repository)
- [Local Validation](#local-validation)
- [Adding or Updating a Chain](#adding-or-updating-a-chain)
  - [Steps](#steps)
  - [PR Checklist](#pr-checklist)
- [CI and Deployment](#ci-and-deployment)
- [Source and License](#source-and-license)

## Overview

### Published Files

| File | URL | Used by | Contents |
| --- | --- | --- | --- |
| `registry.json` | `https://zenaaddev.github.io/xplayz-chain-registry/registry.json` | Release builds (and development builds that point at it) | Release chains: `cosmos/`, in `order` |
| `registry-testnet.json` | `https://zenaaddev.github.io/xplayz-chain-registry/registry-testnet.json` | **Development builds only** | Every release chain in `registry.json`, followed by their testnets (`cosmos-testnet/`, in `testnetOrder`). `version` and `source` are the same as `registry.json` |
| `ibc-destinations.json` | `https://zenaaddev.github.io/xplayz-chain-registry/ibc-destinations.json` | IBC send («destination chain» candidates) | For each known token on the release chains (the app's built-in XPLA mainnet + the `registry.json` chains), the release chains it can reach in one hop and its denom there |

The Pages root (`index.html`) links to the three files.

### How the App Uses Them

- The app reads the registry URL from `EXPO_PUBLIC_CHAIN_REGISTRY_URL`. **Release builds use `registry.json` only.** Only development builds set it to `registry-testnet.json`.
- The app caches the file it receives. When it cannot fetch it, the app runs on the cache, or on the copy built into the app (as of release).
- The app validates what it receives against its registry schema (`apps/mobile/src/lib/chains/registry/schema.ts`) and drops invalid entries. `scripts/build.mjs` applies the same rules first, so invalid entries never reach a published file.
- The app accepts a registry URL only if it is `https`, has no user name or password, and is not on `raw.githubusercontent.com`.
- **Why there is a testnet file:** to try app features such as cancelling an unbonding or transaction-search history with real transactions on testnets. A chain a user adds through «Add chain» has no place for `features` or `txSearch`, so it cannot be used for these checks. Testnets are therefore served here, held to the same standard as mainnets.
- **IBC destination list:** the app reads «destination chain» candidates for IBC send from `ibc-destinations.json` and re-checks the channel against the node. The list only supplies candidates.

### What Does Not Belong Here

- **CONX mainnet and testnet** (`xpla-mainnet` / `dimension_37-1`, `xpla-testnet` / `cube_47-5`). They are built into the app as the source of truth. `build.mjs` rejects them, and the app would drop them anyway.
- **Chain logos.** They ship with the app, not this repository.
- **Received IBC denoms added only for display.** See [The Role of `currencies`](#the-role-of-currencies).
- **Secrets** such as the Skip API key. See [Skip API Key](#skip-api-key).

## Requirements and Preparation

- **Node.js 20 or later.** The scripts have no dependencies, so there is no `npm install`. CI runs Node 22.
- **Source data:** take the chain values from [cosmos/chain-registry](https://github.com/cosmos/chain-registry) (testnets from `testnets/`) and convert them to the format below. Drop every field that is not in the [field list](#field-requirements).
- **Nodes:** use public nodes, and pick them by actually calling them (a balance query and a transaction search) before adding them.
- **Address-affecting changes** (`id`, `bech32Prefix`, `coinType`, `keyType`) need an app-side review. See the warning in [Adding or Updating a Chain](#adding-or-updating-a-chain).
- A merge to `main` is deployed right away. The app picks it up on its next launch.

## Directory Structure

```
.
├── cosmos/                       # Release chains, one file per chain: <id>.json, "testnet": false
│   ├── axelar.json
│   ├── cosmoshub.json
│   ├── injective.json
│   ├── noble.json
│   └── osmosis.json
├── cosmos-testnet/               # Testnet chains, one file per chain: <id>.json, "testnet": true
│   ├── cosmoshub-testnet.json
│   ├── injective-testnet.json
│   └── osmosis-testnet.json
├── registry.config.json          # version, source, chain order (order / testnetOrder), extra IBC source tokens (ibcSources)
├── scripts/
│   ├── build.mjs                 # Validate + merge → dist/registry.json, dist/registry-testnet.json, dist/index.html
│   └── ibc-destinations.mjs      # IBC destination list → dist/ibc-destinations.json (calls the Skip API)
├── .github/workflows/pages.yml   # PRs: validate only. main, schedule, manual: validate → destination list → deploy dist/ to Pages
└── dist/                         # Build output (git-ignored)
```

## Chain File Format

A chain file follows the app's registry schema (`apps/mobile/src/lib/chains/registry/schema.ts`). Any field outside the list below fails validation.

### Example

`cosmos/cosmoshub.json` at the time of writing. The file in `cosmos/` is the source of truth.

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

### Field Requirements

The constraints below are the ones `scripts/build.mjs` enforces. «Text» means a non-empty string of at most 512 characters after trimming. «HTTPS URL» means a URL of at most 2048 characters with the `https:` scheme, a host, and no user name or password.

| Field | Required | Format and constraints | Example | Meaning |
| --- | --- | --- | --- | --- |
| `id` | Yes | `^[a-z0-9][a-z0-9-]{0,63}$`. Must equal the file name without `.json`. Must not be `xpla-mainnet` or `xpla-testnet` | `cosmoshub` | App-internal id. 🔴 Changing it breaks users' «enabled chains» record |
| `chainId` | Yes | Text. Must not be `dimension_37-1` or `cube_47-5` | `cosmoshub-4` | Chain ID |
| `name` | Yes | Text | `Cosmos Hub` | Display name |
| `bech32Prefix` | Yes | `^[a-z0-9]{1,83}$` | `cosmos` | Address prefix. 🔴 Changing it changes user addresses |
| `coinType` | Yes | Integer, 0 – 2147483647 (2³¹ − 1) | `118` | BIP-44 coin type. 🔴 Changing it changes user addresses |
| `keyType` | Yes | `secp256k1` or `eth_secp256k1` | `secp256k1` | Key scheme. 🔴 Changing it changes user addresses |
| `pubKeyTypeUrl` | Yes | Text | `/cosmos.crypto.secp256k1.PubKey` (Injective: `/injective.crypto.v1beta1.ethsecp256k1.PubKey`) | Public key type of the key scheme |
| `feeDenom` | Yes | Text | `uatom` | Fee token |
| `display` | Yes | `{ symbol, decimals }`, see [Token Objects](#token-objects) | `{ "symbol": "ATOM", "decimals": 6 }` | How the native token is shown |
| `lcd` | Yes | HTTPS URL | `https://cosmos-rest.publicnode.com` | REST (LCD) node |
| `rpc` | No | HTTPS URL | `https://cosmos-rpc.publicnode.com` | RPC node |
| `explorerTx` | Yes | HTTPS URL that contains the literal `${txHash}` | `https://www.mintscan.io/cosmos/transactions/${txHash}` | Explorer transaction page |
| `explorerAccount` | Yes | HTTPS URL that contains the literal `${accountAddress}` | `https://www.mintscan.io/cosmos/accounts/${accountAddress}` | Explorer account page |
| `features` | Yes | Array, possibly empty, of `cosmwasm`, `staking`, `cancel-unbonding`, `evm-min-gas-price` | `["cosmwasm", "staking", "cancel-unbonding"]` | See [Features](#features) |
| `stakeCurrency` | No | `{ denom, symbol, decimals }`, see [Token Objects](#token-objects) | `{ "denom": "uatom", "symbol": "ATOM", "decimals": 6 }` | Staking token |
| `gasAdjustment` | Yes | Number, 1 ≤ value ≤ 3 | `1.3` | Gas multiplier |
| `minGasPrice` | Yes | Decimal **string** matching `^\d+(\.\d+)?$`, at most 256 characters, value at most 10¹⁴. With `evm-min-gas-price`, an integer string only | `"0.025"` | Minimum gas price in `feeDenom` |
| `testnet` | Yes | `true` or `false`. Must be `false` in `cosmos/` and `true` in `cosmos-testnet/` | `false` | Testnet flag |
| `hideInUI` | No | `true` or `false` | `true` | IBC-origin-only chain: kept so the app can resolve IBC tokens that came from it (symbol, decimals, price id). The app leaves it out of chain management, enabling and send targets, and `ibc-destinations.json` leaves it out |
| `txSearch` | No | `{ lcd: HTTPS URL, param: "query" or "events" }` | `{ "lcd": "https://cosmos-rest.publicnode.com", "param": "query" }` | Node and query parameter for transaction history. Without it the app shows no history for the chain |
| `currencies` | No | Array of at most **100** `{ denom, symbol, decimals }` | see the example | Known tokens, see [The Role of `currencies`](#the-role-of-currencies) |

**`txSearch.param`:** the app calls `GET {txSearch.lcd}/cosmos/tx/v1beta1/txs?{param}=message.sender='<address>'` (and `transfer.recipient`). Use `query` for nodes that take the `query` parameter (Cosmos SDK v0.50 and later) and `events` for older nodes. Check it against the node with a real search.

### Token Objects

| Object | Fields |
| --- | --- |
| `display` | `symbol`: text. `decimals`: integer 0 – 255 |
| `stakeCurrency`, each `currencies` item | `denom`: text. `symbol`: text. `decimals`: integer 0 – 255. `coinGeckoId` (optional): `^[a-z0-9-]{1,100}$` |

**`symbol`:** use the symbol Skip recommends for that denom on that chain (`recommended_symbol` in `GET https://api.skip.build/v2/fungible/assets?chain_ids=<chainId>`). This is the notation wallets such as Keplr use: a bridged token carries a suffix for where it came from, for example `USDC.axl` (USDC through Axelar), `USDC.n` (Noble USDC) and `USDT.kava`. If Skip does not list the denom, use the cosmos/chain-registry symbol. `display.symbol` follows the same rule for `feeDenom`.

**`coinGeckoId`:** the xPlayz price server collects the `coinGeckoId` values in `currencies` and `stakeCurrency` of release chains (`cosmos/`) and fetches their prices from CoinGecko. Add it only when CoinGecko confirms that the id names this exact denom: the coin's platform address on CoinGecko equals the denom, or the denom trace on the chain leads to the token the id names. A bridged token (for example an Axelar token) usually has its own id, separate from the original token. Do not add it to `cosmos-testnet/` files.

### Features

| Value | What the app does |
| --- | --- |
| `cosmwasm` | Turns on CosmWasm features (NFT collections) for the chain. Add it when the chain runs the wasm module, for example when the LCD answers `/cosmwasm/wasm/v1/code` |
| `staking` | Shows staking (validators, delegate, and so on) for the chain |
| `cancel-unbonding` | Offers cancelling an unbonding delegation (restake) |
| `evm-min-gas-price` | Reads the minimum gas price from `/cosmos/evm/vm/v1/min_gas_price` on the LCD, rounded up to an integer, and falls back to `minGasPrice` when that call fails. Refuses to send when the node's price is more than 10 × `minGasPrice`. `minGasPrice` must be an integer string |

### The Role of `currencies`

- **Known tokens.** The tokens a chain knows about, with their symbol and decimals.
- **IBC send source tokens.** `scripts/ibc-destinations.mjs` asks Skip about every `currencies` denom (plus `feeDenom` and `stakeCurrency`) to build `ibc-destinations.json`. **To make a token an IBC send candidate, open a PR that adds it to `currencies`.** Once merged, it is included in that deployment.
- **Do not add a received IBC denom (`ibc/…`) by hand only so the app can show its name and decimals.** The app resolves a received IBC token by following its denom trace to the source chain. Return routes for tokens that arrived from another release chain are generated without them being in `currencies` (see [How It Is Generated](#how-it-is-generated)).
- At most 100 entries per chain.

### Registry-wide Rules

`scripts/build.mjs` also checks the following across files.

- Every file is a JSON object with all required fields and no unknown fields.
- The file name is `<id>.json`, and `testnet` matches the folder (`cosmos/` → `false`, `cosmos-testnet/` → `true`).
- Every file in `cosmos/` is listed in `order`, every id in `order` has a file, and no id appears twice. The same holds for `cosmos-testnet/` and `testnetOrder`.
- `id` and `chainId` must be unique across both folders, because `registry-testnet.json` merges them (the app would drop the later one).
- The CONX built-in chains (`xpla-mainnet`, `xpla-testnet`, `dimension_37-1`, `cube_47-5`) are rejected.
- Each published file must be at most 256 KB (262,144 bytes), the app's `CHAIN_REGISTRY_JSON_LIMIT`. `registry.json` and `registry-testnet.json` are checked separately, and `ibc-destinations.json` has the same limit.
- In `registry.config.json`, `version` must be `1` and `source` must be text.

## registry.config.json

```json
{
  "version": 1,
  "source": "cosmos/chain-registry (CC BY 4.0)",
  "order": ["cosmoshub", "osmosis", "injective", "noble", "axelar"],
  "testnetOrder": ["cosmoshub-testnet", "osmosis-testnet", "injective-testnet"],
  "ibcSources": {
    "dimension_37-1": ["axpla"]
  }
}
```

| Field | Meaning |
| --- | --- |
| `version` | Must be `1`. Written to both registry files |
| `source` | Attribution text, written to both registry files |
| `order` | Release chain ids in the order they appear in `registry.json`. Must match the files in `cosmos/` exactly |
| `testnetOrder` | Testnet chain ids in order. In `registry-testnet.json` they come after the release chains. Must match the files in `cosmos-testnet/` exactly |
| `ibcSources` | Extra source tokens for the IBC destination list: `{ chainId: [denom, …] }`. Holds the app's built-in XPLA mainnet, which has no file here |

## IBC Destination List

### Format

`ibc-destinations.json` is a contract with the app's parser (app ADR-035).

```json
{
  "version": 1,
  "generatedAt": "2026-11-19T14:56:33.766Z",
  "routes": {
    "<source chainId>": {
      "<source denom>": {
        "<destination chainId>": ["<destination denom>", "…"]
      }
    }
  }
}
```

For example, `routes["dimension_37-1"]["axpla"]` is `{ "cosmoshub-4": ["ibc/102A112CAEE6E503721048E5B2221252E40ABAB8B4344680E28F17BEAC9F9FB1"], "osmosis-1": ["ibc/95C9B5870F95E21A242E6AF9ADCB1F212EE4A8855087226C36FBE43FC41A77B8"] }`.

🔴 The app discards a file it cannot parse. Agree on any format change with the app side first. The file is limited to 256 KB.

### How It Is Generated

`scripts/ibc-destinations.mjs` asks the Skip API (`POST https://api.skip.build/v2/fungible/assets_from_source`, `allow_multi_tx: false`).

1. **Source tokens:** for each release chain (`cosmos/`, in `order`), its `feeDenom`, `stakeCurrency` and every `currencies` denom, plus `registry.config.json` `ibcSources` (the app's built-in XPLA). CW20 tokens (`cw20:`) are skipped. Chains with `hideInUI: true` are skipped, so they are neither sources nor destinations.
2. **Destinations:** only other release chains, only bank denoms (no CW20), deduplicated and sorted.
3. **Return routes:** an IBC denom (`ibc/…`) that arrives on another release chain in the first answers is asked once more as a source token on that chain.
4. **Retries:** each query is tried up to 4 times (20 s timeout, back-off between tries, 4 queries in parallel). A 404 («route not found») means «no destinations», not a failure. 429, 5xx and timeouts are retried. Other 4xx are not.
5. **All or nothing:** if any query ultimately fails, a 200 response has no `dest_assets`, no route is found at all, or the file would exceed 256 KB, the script writes nothing and exits with 1.

### When It Runs and What Happens on Failure

- On every merge to `main`, once a day at 03:17 UTC (12:17 KST), and on manual runs (Actions → `registry` → Run workflow). Pull requests only validate.
- If the script fails, the workflow does not write a new file. It re-publishes the currently deployed `ibc-destinations.json` (never an empty or partial list), and after the deploy the `stale` job fails the run so a notification goes out.
- If nothing has been deployed yet (first deployment), the build job fails and the current deployment stays.

### Skip API Key

If the repository secret `SKIP_API_KEY` is set, the script sends it as the `authorization` header. Otherwise it calls without a key, on the public rate limit. **Keep the key only in this repository's secrets.** Never put it in the app, code, or docs. Only this script calls Skip, so the app needs no key and the number of Skip calls does not grow with the number of app users.

### Scheduled Runs on a Public Repository

🔴 GitHub disables scheduled workflows on a public repository after 60 days without repository activity. If that happens, re-enable the `registry` workflow in the Actions tab (Enable workflow). While it is disabled, the app keeps running on the last deployed file, its cache, and its built-in copy.

## Local Validation

```sh
# Validate only. Run this before every PR.
node scripts/build.mjs --check

# Validate and write dist/registry.json, dist/registry-testnet.json, dist/index.html (CI runs this form)
node scripts/build.mjs

# Syntax-check the IBC script (CI runs this on PRs as well)
node --check scripts/ibc-destinations.mjs

# Optional: generate dist/ibc-destinations.json locally. Calls the Skip API without a key (public rate limit)
node scripts/ibc-destinations.mjs
```

On success `build.mjs` prints one line starting with `OK —` that gives the chain count and byte size of each file, and exits with 0. On failure it prints one `<file>: <reason>` line per problem and exits with 1.

## Adding or Updating a Chain

### Steps

1. Create a branch from `main`.
2. Add or edit `cosmos/<id>.json` (testnets: `cosmos-testnet/<id>.json`). For a new chain, add its id to `order` in `registry.config.json` (testnets: `testnetOrder`). The position sets the display order.
3. Run `node scripts/build.mjs --check`.
4. Open a PR against `main`. CI runs the same validation (`build` check). Before adding nodes, call the public nodes for real (balance query and transaction search).
5. Once merged, the workflow deploys. The app picks it up on its next launch.

> 🔴 **A PR that changes `id`, `bech32Prefix`, `coinType` or `keyType` affects user addresses and users' «enabled chains».** Review it together with the app side.

### PR Checklist

- [ ] `node scripts/build.mjs --check` passes.
- [ ] The file name equals `id`, and `testnet` matches the folder.
- [ ] A new chain is added to `order` (or `testnetOrder`).
- [ ] `lcd`, `rpc` and `txSearch.lcd` are public HTTPS nodes that answered a real balance query and transaction search.
- [ ] `explorerTx` and `explorerAccount` contain `${txHash}` and `${accountAddress}`.
- [ ] `currencies` has at most 100 entries and no received IBC denom added only for display.
- [ ] Changes to `id`, `bech32Prefix`, `coinType` or `keyType` are reviewed with the app side.
- [ ] No secrets (such as the Skip API key) in files, commits or the PR.
- [ ] The `build` check on the PR passes.

## CI and Deployment

`.github/workflows/pages.yml` (workflow name `registry`, Node 22):

| Trigger | `build` | `deploy` | `stale` |
| --- | --- | --- | --- |
| Pull request | `node scripts/build.mjs`, `node --check scripts/ibc-destinations.mjs` | — | — |
| Push to `main`, schedule (03:17 UTC), manual run | Same as above → `node scripts/ibc-destinations.mjs` (on failure, re-publish the deployed file) → upload `dist/` | Deploy to GitHub Pages | Fails the run after deploy if the destination list was re-published as-is |

Runs share the `pages` concurrency group and are not cancelled when a new one starts.

## Source and License

Chain values are taken from [cosmos/chain-registry](https://github.com/cosmos/chain-registry) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); testnets from `testnets/`), converted to the xPlayz format, and partly changed: node addresses were chosen by measuring public nodes, and unused fields were removed. Chain logos are not in this repository; they ship with the app.

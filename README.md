# JR特急予約依頼メッセージ作成ツール

札幌・新札幌と帯広・釧路の間で利用する特急「おおぞら」「とかち」について、乗車券・特急券の手配依頼文を作る個人用Webアプリです。

## 主な機能

- 往復／片道
- 往路と復路で独立した乗降駅（車移動後に別の駅から戻る旅程に対応）
- すべて／午前／午後で列車を絞り込み（初期値は往路=午前、復路=午後）
- 往路・復路ごとに利用列車を1本選択
- 指定席／グリーン車、窓側／通路側／どちらでもよい
- Teams貼り付け用メッセージのコピー
- Googleカレンダー／iPhoneカレンダー登録
- ダイヤ確認日と公式確認リンクの表示

## 開発

```bash
npm install
npm run dev
npm run lint
npm run build
```

## ダイヤ更新

ダイヤは `data/timetable-source.csv` を正本として管理し、`src/data/timetable.json` は自動生成します。

```bash
npm run timetable:generate
npm run timetable:check
```

更新時は必ず [docs/TIMETABLE_UPDATE.md](docs/TIMETABLE_UPDATE.md) に従ってください。公式情報の探し方、CSVの全列、検査内容、公開確認、戻し方まで記載しています。

## データに関する注意

本アプリのダイヤは確認日時点の静的データです。旅行前にJR北海道公式の時刻検索と運行情報を必ず再確認してください。公式検索結果を自動取得・転載する処理は実装していません。

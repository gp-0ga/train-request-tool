# train-request-tool

JR北海道の特急「おおぞら」「とかち」の乗車券・特急券手配依頼メッセージを作る個人用SPAです。

## 必須ルール

- `master`へのpushはGitHub Pagesへ公開されるため、`npm run lint`と`npm run build`を通す。
- ダイヤの正本は`data/timetable-source.csv`。`src/data/timetable.json`を直接編集しない。
- ダイヤ更新は`docs/TIMETABLE_UPDATE.md`の全チェックを実施する。
- 往路と復路の駅は独立状態として保持し、車移動を挟む旅程を壊さない。
- 第2希望は依頼文に含めるが、カレンダーには第1希望だけを登録する。
- 座席の初期値は「指定席・窓側」。往路・復路で個別変更可能にする。
- 公式検索結果を自動取得・転載しない。改正監視はニュースリリースの検知までとする。
- iOSのICSはBlob URLへ遷移し、`download`属性を付けない。
- GitHub Pages用の`base: '/train-request-tool/'`を維持する。

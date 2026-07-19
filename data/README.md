# 時刻表データの構成

| ファイル | 役割 | 人が編集するか |
|---|---|---|
| `timetable-source.csv` | 列車・駅ごとの時刻の正本 | はい |
| `timetable-metadata.json` | 適用日、確認日、公式リンク | はい |
| `../src/data/timetable.json` | アプリが読む生成物 | いいえ |

`timetable.json`を直接編集しても、検査で不一致として失敗します。必ずCSVとメタデータを編集してから `npm run timetable:generate` を実行してください。

## CSV列

- `id`: `ozora-1`、`tokachi-2`の形式。重複不可
- `name`: `おおぞら`または`とかち`
- `number`: 号数。札幌発方面は奇数、札幌着方面は偶数
- `direction`: 札幌発は`eastbound`、札幌着は`westbound`
- 各駅の`_arrival`／`_departure`: `HH:mm`形式。停車しない駅は空欄

帯広では、おおぞらに着時刻と発時刻の両方があります。とかちは終着または始発なので必要な片方だけを入力します。

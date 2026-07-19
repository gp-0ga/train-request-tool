# ダイヤ更新手順書

この手順書だけで更新を完了できるように、確認先・入力箇所・検査・公開・復旧をまとめています。

## 0. 自動化されている範囲

1. JR北海道のニュースリリースから、次回3月の「ダイヤ改正」発表を毎週検知します。
2. 未確認の発表なら `timetable-update` ラベル付きGitHub Issueを作成します。
3. CSVを更新ブランチへ保存すると、GitHub Actionsが `timetable.json` を生成して同じブランチへコミットします。
4. Pull Requestでは時刻表検査、lint、本番ビルドを実行します。
5. `master`へマージするとGitHub Pagesへ公開します。

新しい時刻を公式サイトで確認してCSVへ入力する部分だけは人が行います。公式検索結果の自動取得・転載は行いません。

## 1. 必ず開く公式ページ

- [JR北海道 時刻・運賃検索](https://www.jrhokkaido.co.jp/global/)
- [JR北海道 駅の情報・時刻表](https://www.jrhokkaido.co.jp/network/station/station.html)
- [JR北海道 列車運行情報](https://www3.jrhokkaido.co.jp/trainlocation/)
- [JR北海道 ニュースリリース](https://www.jrhokkaido.co.jp/CM/Info/press/)

確認対象は「おおぞら」「とかち」の定期特急です。臨時列車は、通常の選択肢へ常設すべきか判断してから追加します。

## 2. 更新前チェック

- [ ] ダイヤ改正の適用日を確認した
- [ ] 札幌→釧路を「始発」で検索した
- [ ] 新札幌→釧路を確認した
- [ ] 札幌→帯広を確認し、とかちだけでなく帯広停車のおおぞらも含めた
- [ ] 釧路→札幌を「始発」で検索した
- [ ] 帯広→札幌を確認し、とかち・おおぞらの両方を含めた
- [ ] 改正日以後の日付で検索した
- [ ] 検索結果の更新日を確認した

## 3. GitHub上で更新ブランチを作る

1. `data/timetable-source.csv` をGitHubで開きます。
2. 鉛筆アイコン（Edit this file）を押します。
3. `Create a new branch for this commit and start a pull request` を選びます。
4. ブランチ名を `timetable/YYYY-MM-DD` にします。日付はダイヤ適用日です。
5. CSVを編集してコミットします。

ローカルで作業する場合も、`master`ではなく同じ命名の更新ブランチを使います。

## 4. CSV入力規則

編集ファイル: `data/timetable-source.csv`

| 列 | 入力内容 |
|---|---|
| `id` | `ozora-1`、`tokachi-2` |
| `name` | `おおぞら`／`とかち` |
| `number` | 半角数字の号数 |
| `direction` | 札幌発=`eastbound`、札幌着=`westbound` |
| `sapporo_arrival/departure` | 札幌の着／発 |
| `shin_sapporo_arrival/departure` | 新札幌の着／発 |
| `obihiro_arrival/departure` | 帯広の着／発 |
| `kushiro_arrival/departure` | 釧路の着／発。とかちは空欄 |

時刻は必ず`06:48`のような24時間制`HH:mm`で入力します。`6:48`、`6時48分`、全角数字は使用しません。

### 下りの例

```csv
ozora-1,おおぞら,1,eastbound,,06:48,,06:56,09:18,09:19,10:56,
tokachi-1,とかち,1,eastbound,,07:58,,08:07,10:43,,,
```

### 上りの例

```csv
ozora-2,おおぞら,2,westbound,10:41,,10:33,,07:52,07:54,,06:18
tokachi-2,とかち,2,westbound,09:34,,09:25,,,06:45,,
```

## 5. メタデータ更新

編集ファイル: `data/timetable-metadata.json`

- `effectiveFrom`: 新ダイヤ適用日
- `checkedAt`: 公式検索を確認した日
- `officialSearchUrl`: 公式検索URL。通常は変更不要
- `operationInfoUrl`: 公式運行情報URL。通常は変更不要
- `sourceNote`: 特記事項があれば追記

メタデータも同じ更新ブランチへコミットします。

## 6. JSON生成

### GitHubだけで更新する場合

CSVまたはメタデータをブランチへ保存すると、`Generate timetable JSON` Actionが次を自動実行します。

1. CSVとメタデータを検査
2. `src/data/timetable.json` を生成
3. `github-actions[bot]` が生成物を同じブランチへコミット
4. lintと本番ビルドを実行

Actions画面で緑のチェックになるまで待ちます。赤になった場合、ログの日本語エラーに対象列車と原因が表示されます。

### ローカルで更新する場合

```bash
npm install
npm run timetable:generate
npm run timetable:check
npm run lint
npm run build
```

## 7. 自動検査の内容

- CSVの列数
- ID重複とID形式
- 列車名が「おおぞら」「とかち」のどちらか
- 下りは奇数、上りは偶数
- 札幌・新札幌・帯広の時刻が存在する
- おおぞらには釧路時刻が存在する
- とかちには釧路時刻が入っていない
- 時刻が24時間制`HH:mm`
- 進行方向に沿って時刻が逆転していない
- CSVから再生成したJSONとリポジトリ内JSONが一致する
- TypeScript、Vite本番ビルドが成功する

## 8. Pull Requestで目視する組み合わせ

プレビューまたはローカル画面で次を各1件確認します。

- [ ] 札幌→帯広：おおぞら・とかちが両方表示される
- [ ] 新札幌→釧路：おおぞらだけ表示される
- [ ] 釧路→札幌：おおぞらだけ表示される
- [ ] 帯広→新札幌：おおぞら・とかちが両方表示される
- [ ] 往路 札幌→釧路、復路 帯広→新札幌を同時に選べる
- [ ] 第2希望が第1希望と別列車になる
- [ ] 依頼文の発着時刻が公式情報と一致する
- [ ] カレンダーには第1希望だけ入る
- [ ] 画面のダイヤ確認日が更新されている

目安件数は、帯広発着が各方向11本、釧路発着が各方向6本です。ダイヤ改正で本数が変わった場合は、公式発表を優先し、この目安も更新してください。

## 9. 公開と公開後確認

1. Pull Requestの全チェックが緑であることを確認します。
2. `master`へマージします。
3. `Deploy to GitHub Pages` Actionの完了を待ちます。
4. 公開URLをスマホとPCで再読み込みします。
5. 画面の「ダイヤ確認日」と代表4区間を確認します。
6. 対応するGitHub Issueを閉じます。

## 10. 間違いが見つかった場合

公開前ならPull RequestをマージせずCSVを修正します。公開後なら、直前の時刻表更新Pull RequestをGitHubの`Revert`で戻すか、正しいCSVを新しい修正ブランチで更新します。`timetable.json`だけを直接直さないでください。

緊急時は公開画面上部の公式時刻検索・運行情報リンクを使い、依頼前に公式情報を優先します。

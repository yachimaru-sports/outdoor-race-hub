# OUTDOOR RACE HUB 自動更新システム 設定手順書

本ドキュメントでは、OUTDOOR RACE HUB の大会マスターデータおよび必携ギア情報を毎朝8時（JST）に完全自動・高精度で同期・更新するための設定手順を解説します。

---

## 📋 必要な環境設定・シークレット一覧

GitHub Actions の `Settings` > `Secrets and variables` > `Actions` に以下のシークレットを登録します。

| シークレット名 | 必須 | 概要 | 取得元 |
| :--- | :---: | :--- | :--- |
| `RAKUTEN_APP_ID` | **必須** | 楽天市場商品検索API用 アプリケーションID | [楽天Developers](https://webservice.rakuten.co.jp/) |
| `GCP_SA_KEY` | **必須** | Google Cloud サービスアカウントJSONキー | [Google Cloud Console](https://console.cloud.google.com/) |
| `RAKUTEN_AFFILIATE_ID` | 任意 | 楽天アフィリエイトID（省略時は既存IDが自動適用） | 楽天アフィリエイト管理画面 |

---

## 🛠️ 詳細設定手順

### ステップ 1: 楽天市場 アプリケーションID（`RAKUTEN_APP_ID`）の取得
1. [Rakuten Developers（楽天ウェブサービス）](https://webservice.rakuten.co.jp/) にログイン（楽天会員ID）。
2. 右上の「アプリ登録」をクリックします。
3. アプリ名（例: `Outdoor Race Hub Sync`）とサイトURL（例: `https://yachimaru-sports.github.io/outdoor-race-hub/`）を入力して作成します。
4. 発行された **「アプリID / デベロッパーID（applicationId）」** （英数字）をコピーします。

---

### ステップ 2: Google Cloud サービスアカウント（`GCP_SA_KEY`）の準備
Googleスプレッドシートへの安全なAPI自動書き込みを行うために、サービスアカウントを作成します。

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスし、プロジェクトを選択（または新規作成）します。
2. **APIの有効化**:
   - 上部検索バーで「**Google Sheets API**」を検索し、「有効にする」をクリック。
   - 同様に「**Google Drive API**」を検索し、「有効にする」をクリック。
3. **サービスアカウントの作成**:
   - 左側メニューの「IAMと管理」 > 「**サービスアカウント**」を開きます。
   - 「サービス アカウントを作成」をクリック。
   - サービスアカウント名（例: `race-hub-sync-bot`）を入力し、「作成して続行」をクリック（ロール付与は任意、そのまま「完了」で可）。
4. **JSON秘密鍵の発行**:
   - 作成したサービスアカウントの一覧から、該当のアカウントをクリック。
   - 「**キー**」タブを開き、「鍵を追加」 > 「**新しい鍵を作成**」を選択。
   - キーのタイプで「**JSON**」を選択し、「作成」をクリックします。
   - JSONファイルがPCに自動ダウンロードされます。
   - **ダウンロードされたJSONファイルの内容（テキスト全文）をすべてコピーします。**

---

### ステップ 3: Googleスプレッドシートへの共有設定（★最重要）
作成したサービスアカウントに、2枚のスプレッドシートへの「編集権限」を付与します。

1. 作成したサービスアカウントの **メールアドレス**（例: `race-hub-sync-bot@xxxx.iam.gserviceaccount.com`）をコピーします。
2. 以下の2枚のスプレッドシートをブラウザで開きます：
   - 📊 **ギアウォッチリスト**: [1Fs7dmlsHorYsswPMOKrVZVvK06cIqpWmfpxm6XWgQEg](https://docs.google.com/spreadsheets/d/1Fs7dmlsHorYsswPMOKrVZVvK06cIqpWmfpxm6XWgQEg/edit)
   - 📊 **大会マスター**: [1GckzxJfV2soq9FYAIx94u3nrhw5DD1WcUS27dfuzuuQ](https://docs.google.com/spreadsheets/d/1GckzxJfV2soq9FYAIx94u3nrhw5DD1WcUS27dfuzuuQ/edit)
3. それぞれのスプレッドシート右上の「**共有**」ボタンをクリックします。
4. コピーしたサービスアカウントのメールアドレスを貼り付け、権限を「**編集者**」に設定して「送信」（または「共有」）をクリックします。

---

### ステップ 4: GitHub Secrets への登録
1. GitHubの `yachimaru-sports/outdoor-race-hub` リポジトリページを開きます。
2. 上部メニューの「**Settings**」をクリック。
3. 左サイドバーの「**Secrets and variables**」 > 「**Actions**」をクリック。
4. 「**New repository secret**」ボタンをクリックし、以下を1つずつ登録します：
   - **Secret 1**:
     - Name: `RAKUTEN_APP_ID`
     - Secret: ステップ1で取得した楽天アプリID
   - **Secret 2**:
     - Name: `GCP_SA_KEY`
     - Secret: ステップ2でダウンロードしたJSONファイルの全文（`{` から `}` までそのまま貼り付け）

---

### ステップ 5: 動作確認（手動実行テスト）
1. GitHubリポジトリ上部の「**Actions**」タブをクリックします。
2. 左側のアクション一覧から「**Daily Auto Sync & Update (Every Morning 8:00 JST)**」を選択します。
3. 右側の「**Run workflow**」プルダウンをクリックし、緑色の「**Run workflow**」ボタンを押します。
4. ワークフローが起動し、各ステップ（楽天API連携・リンク検証・スプレッドシート同期・自動コミット・GitHub Pagesデプロイ）が緑色（Success）で完了すれば設定完了です！
5. 翌朝以降、毎日 JST 08:00（UTC 23:00）に全自動で巡回・更新が行われます。

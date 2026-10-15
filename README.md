# PulseQuiz — 活動現場即時問答

靜態網站 + Supabase，適用於校園講座、迎新、社團活動、簡易隨堂測驗。主持人建立活動與題目，參加者輸入代碼與暱稱作答，主持人可控制題目開關、查看票數與百分比、公開統計並切換投影畫面。

## 已實作

- 主持人登入與註冊（Supabase Auth 電子郵件／密碼）
- 建立活動、六碼代碼、加入連結、QR Code
- 新增／編輯未發布題目、2～6 選項、指定答案、開放或關閉題目
- 手機免註冊作答；每個活動每個裝置的同一題只接受首次提交
- 3 秒自動更新統計，參加者只看得到已公布的關閉題目結果
- Supabase RLS 限制管理操作；參加者透過裝置 token 的 SHA-256 雜湊進行 RPC 驗證
- 與舊系統獨立的 evq_ 資料表；不會修改既有 cp2_ 系統

## 部署到 GitHub Pages

1. 打開本儲存庫 → **Settings → Pages → Build and deployment → GitHub Actions**，啟用 GitHub Pages。
2. 推送到 main 後，`.github/workflows/pages.yml` 自動執行部署；可在 Actions 檢查。
3. 若要註冊主持人，請至 [Supabase Dashboard](https://supabase.com/dashboard/project/mexndpdexhhqshcwyqxk/auth/url-configuration) 設定 **Site URL** 和 **Redirect URLs**，允許 `https://d1144251002-oss.github.io/123/`。已啟用信箱驗證時，註冊後須先驗證信箱。
4. 主持人登入 → 建立活動 → 開始活動 → 建題 → 開放題目 → 分享代碼與 QR。
5. 若設定改用其他 Supabase 專案，請依序執行 `supabase/migrations/` 裡的兩份 SQL，並修改 `app.js` 的公開 Project URL / publishable key。

## 安全與功能限制

- 前端僅可放 **publishable key**，**不可**放 service_role 或其他機密金鑰。
- 參加者不用 Supabase Auth 帳號，隨機 UUID token 存在瀏覽器 localStorage，在資料庫只儲存 SHA-256 雜湊。這能避免**同一裝置**重複送出，但無法阻止刻意使用不同瀏覽器／清除 localStorage 的重複報名。**不適合正式選舉或高風險考試。**
- 活動限制：最多 2,000 名參加者、100 題／場、2～6 個選項。
- 資料每約 3 秒輪詢，屬於**近即時**，不是保證毫秒同步的 WebSocket。
- QR 圖使用第三方 `api.qrserver.com`；無法載入時仍可手動輸入代碼。
- 本版本沒有匯出 Excel、訪客身分實名查驗或服務端 IP 速率限制；大型公開活動前請依需求加強。
- **正式使用前**請使用至少兩支手機、主持人筆電與投影設備彩排，並確認網路可連通 Supabase。
- 完成資料庫整合測試、重複提交保護測試與 JavaScript 語法檢查；尚不代表所有瀏覽器、設備與實際高流量都已經過端對端測試。

本機測試：`python3 -m http.server 8080`，打開 `http://localhost:8080`。請勿直接用 file:// 方式開啟。

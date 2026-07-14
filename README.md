# 일본 사입 서류 자동화 (Japan Sourcing Doc Automation)

일본 매장 영수증 사진을 업로드하면 OCR로 품목을 인식하고 한글로 번역한 뒤,
사용자가 품목명을 확인/수정하고 **컨펌**한 품목만으로 패킹리스트 · 상업송장 ·
목록통관용 간이서류(xlsx)를 자동 생성하는 앱입니다.

## 핵심 흐름

1. 사입 건(Shipment) 생성
2. 영수증 사진 업로드 → Claude API(비전)가 품목명(일본어) 인식 + 한글 번역 초안을 한 번에 생성
3. **품목별로 한글명/수량/단가를 확인하고 "컨펌" 버튼을 눌러야 최종 확정** (자동 인식/번역 결과를 그대로 신뢰하지 않고, 사람이 검수하는 단계를 반드시 거칩니다)
4. 컨펌된 품목만 모아 패킹리스트 / 상업송장 / 목록통관용 간이서류(xlsx) 다운로드

## 기술 스택

- Next.js 14 (App Router, TypeScript)
- PostgreSQL + Prisma ORM
- **Claude API** (비전 + 도구 사용) — 영수증 사진에서 품목 인식과 일→한 번역을 한 번의 호출로 처리
- Vercel Blob (영수증 이미지 저장)
- exceljs (엑셀 서류 생성)

## 로컬 실행

```bash
npm install
cp .env.example .env   # 값 채우기
npx prisma migrate dev --name init
npm run dev
```

## 필요한 외부 서비스 (배포 전 준비)

1. **PostgreSQL 데이터베이스** — Vercel Postgres(Neon), Supabase 중 아무거나 사용 가능 (무료 티어로 충분)
2. **Anthropic API 키** — https://console.anthropic.com/settings/keys 에서 발급 (사용량만큼 과금되는 종량제이며, 영수증 1건 인식에 드는 비용은 매우 적습니다. 콘솔의 "Limits"에서 월 지출 한도를 걸어두는 걸 추천합니다.)
3. **Vercel 계정** — GitHub 로그인으로 무료 가입 가능

---

## 배포 단계별 안내 (GitHub → Vercel)

### 1) GitHub 저장소 생성 및 코드 업로드

터미널에서 이 폴더로 이동한 뒤:

```bash
git init
git add .
git commit -m "Initial commit: 일본 사입 서류 자동화 앱"
```

GitHub 웹사이트에서 새 저장소를 만듭니다 (예: `japan-sourcing-app`, Private 권장 — 사입 데이터가 포함되므로).
그 다음 로컬 저장소를 연결하고 푸시합니다:

```bash
git remote add origin https://github.com/<본인계정>/japan-sourcing-app.git
git branch -M main
git push -u origin main
```

### 2) Vercel 프로젝트 생성

1. https://vercel.com 접속 → GitHub 계정으로 로그인
2. "Add New..." → "Project" → 방금 만든 `japan-sourcing-app` 저장소 선택 → Import
3. Framework Preset은 자동으로 "Next.js"로 인식됩니다. 그대로 진행

### 3) 환경변수 설정

Vercel 프로젝트 설정 → **Settings → Environment Variables**에서 아래 값을 추가합니다:

| 변수명 | 값 |
|---|---|
| `DATABASE_URL` | 1단계에서 준비한 PostgreSQL 연결 문자열 (DB를 Vercel Storage에서 만들면 자동 추가됨) |
| `ANTHROPIC_API_KEY` | Anthropic 콘솔에서 발급한 API 키 |
| `BLOB_READ_WRITE_TOKEN` | 아래 4단계에서 생성 |

### 4) Vercel Blob Storage 연결 (영수증 이미지 저장용)

Vercel 프로젝트 → **Storage** 탭 → "Create Database" → "Blob" 선택(Access: **Public**) → 생성.
생성된 스토어 페이지의 **".env.local"** 탭에서 `BLOB_READ_WRITE_TOKEN` 값을 복사해 Environment Variables에 등록합니다.

### 5) 데이터베이스 마이그레이션

배포 전, 로컬 컴퓨터에서 실제 운영 DB에 테이블을 만들어줘야 합니다:

```bash
DATABASE_URL="<운영 DB 연결 문자열>" npx prisma migrate deploy
```

### 6) 배포

Vercel에서 "Deploy" 버튼을 누르면 자동으로 빌드 후 배포됩니다.
이후 GitHub `main` 브랜치에 푸시할 때마다 자동으로 재배포됩니다.
환경변수를 새로 추가/변경한 뒤에는 **Deployments 탭 → 최신 배포 옆 "..." → Redeploy**로 한 번 더 배포해야 반영됩니다.

---

## 참고 및 주의사항

- **인식/번역 정확도**: 일본 영수증 포맷이 매장마다 달라 자동 인식이 완벽하지 않을 수 있습니다.
  그래서 이 앱은 인식/번역 결과를 항상 "초안"으로 두고, 사용자가 직접 확인·수정 후 **컨펌**해야
  서류에 반영되도록 설계했습니다.
- **목록통관용 간이서류**는 관세청 정식 신고 서식이 아닌 참고용 문서입니다. 실제 수입통관 신고는
  특급탁송업체 또는 관세사를 통해 진행해주세요. 본 앱은 법률/통관 자문을 제공하지 않습니다.
- 여러 명이 함께 쓸 계획이라면 로그인/인증 기능이 없다는 점을 참고해주세요 (현재는 링크만 알면
  누구나 접근 가능한 단일 사용자용 구조입니다). 필요하면 이후 인증을 추가할 수 있습니다.
- Anthropic API는 종량제 과금입니다. 예상치 못한 비용을 막으려면 Anthropic 콘솔의 Limits 설정에서
  월 지출 한도를 걸어두는 것을 권장합니다.

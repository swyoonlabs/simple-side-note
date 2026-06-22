# Simple Side Note v1.0.3 Release Notes

## 📝 Overview
v1.0.3에서는 메모 내보내기 기능을 개선하고 사용자 정보 접근성을 향상시켰습니다.

## ✨ What's New

### 🎯 주요 개선사항

#### 1. **Export 형식 변경: .doc → .html**
- **이전**: 메모를 `.doc` 형식으로만 저장 가능
- **현재**: 메모를 `.html` 형식으로 저장하여 모든 운영체제에서 웹 브라우저로 바로 열 수 있음
- **장점**:
  - Mac에서 `.doc` 파일을 열 수 없는 문제 해결 ✅
  - 이미지가 포함된 메모도 완벽하게 저장 및 표시 ✅
  - Windows, Mac, Linux 모두 호환 ✅
  - 파일 크기 감소

#### 2. **About 탭 링크 확대**
새로운 링크 추가:
- 🛒 **Chrome Web Store** - 확장 프로그램 페이지에서 평가 및 설치
- 🔗 **GitHub** - 소스 코드 접근 및 피드백

기존 링크:
- 🌐 Developer Blog
- 🔒 Privacy Policy

#### 3. **버전 업데이트**
- `1.0.2` → `1.0.3`

## 🔧 Technical Details

### Export 함수 개선
```javascript
// 변경 전
const blob = new Blob(['﻿' + html], { type: 'application/msword' });
a.download = filename + '.doc';

// 변경 후
const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
a.download = filename + '.html';
```

### HTML 구조 개선
- 이미지 최적화 CSS 추가: `max-width: 100%; height: auto;`
- 모던 폰트 스택 적용: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`
- 반응형 메타 태그 추가

### Features 업데이트
About 탭의 기능 목록 수정:
```
📥 Export memos as HTML (with images)
```

## 🐛 Bug Fixes
- Mac에서 메모 다운로드 시 이미지가 표시되지 않는 문제 해결
- 호환성 없는 파일 형식으로 인한 열기 실패 문제 해결

## 📊 Compatibility

| OS | v1.0.2 | v1.0.3 |
|---|---|---|
| **Windows** | ✅ .doc | ✅ .html |
| **Mac** | ⚠️ .doc 필요 | ✅ .html |
| **Linux** | ⚠️ .doc 필요 | ✅ .html |
| **이미지 포함** | ❌ 미지원 | ✅ 지원 |

## 🎨 UI/UX 개선
- 다운로드 버튼 툴팁: "Download as .doc" → "Download as .html"
- Chrome Web Store와 GitHub 링크로 더 나은 커뮤니티 연결

## 📢 User Impact
- ✅ 모든 사용자가 이미지 포함 메모를 안전하게 저장 가능
- ✅ Mac 사용자도 웹 브라우저로 메모 바로 열기
- ✅ 오픈소스 커뮤니티와의 더 나은 연결

## 🔗 Related Links
- [Chrome Web Store](https://chromewebstore.google.com/detail/simple-side-note/nfbfojjmjdhoebicleopmalefcbabonl?hl=ko&utm_source=ext_sidebar)
- [GitHub Repository](https://github.com/orgs/swyoonlabs/repositories)
- [Privacy Policy](./privacy-policy.html)

---

**Released**: 2026-06-22  
**Version**: 1.0.3  
**Status**: ✅ Stable

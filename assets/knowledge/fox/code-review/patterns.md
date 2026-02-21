# 코드 리뷰 체크리스트 & 패턴

## 코드 품질 체크리스트
- 함수/메서드 길이: 20줄 이내 권장, 50줄 초과 시 분리 필요
- 중첩 깊이: 3단계 이내, guard clause로 early return 활용
- 변수 네이밍: 의도를 드러내는 서술적 이름 (isLoading, hasError, fetchUserData)
- 매직 넘버 제거: 상수로 추출하여 의미 부여
- DRY 원칙: 3회 이상 반복되면 추상화 고려

## 성능 관련 리뷰 포인트
- 불필요한 리렌더링: React.memo, useMemo, useCallback 적절히 사용
- N+1 쿼리 문제: 배치 로딩, DataLoader 패턴
- 메모리 누수: useEffect cleanup, 이벤트 리스너 해제
- 비동기 처리: Promise.all 병렬 실행, 불필요한 await 제거
- 번들 사이즈: dynamic import, tree-shaking 확인

## 보안 리뷰 포인트
- SQL Injection: parameterized query 사용 확인
- XSS: 사용자 입력 sanitization, dangerouslySetInnerHTML 주의
- CSRF: 토큰 검증 확인
- 인증/인가: 적절한 미들웨어/가드 사용
- 민감 정보: 환경변수로 분리, .env 커밋 방지

## 테스트 리뷰 포인트
- 테스트 커버리지: 핵심 비즈니스 로직 80% 이상
- 경계값 테스트: null, undefined, 빈 배열, 음수
- 비동기 테스트: waitFor, act 적절히 사용
- 모킹: 외부 의존성 적절히 격리

## 흔한 안티패턴
- God Object: 하나의 클래스/컴포넌트가 너무 많은 책임
- Prop Drilling: Context 또는 상태관리 라이브러리로 해결
- Premature Optimization: 프로파일링 없이 최적화하지 않기
- Callback Hell: async/await으로 평탄화
- 과도한 추상화: YAGNI 원칙 -- 필요할 때 추상화

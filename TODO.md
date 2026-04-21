# WeCast Production Fix: Audio/Transcript Empty on Render



**Step 1: Backend (app.py) - PRIORITY**
- [ ] Update resolve_podcast_media_urls() to prefer R2_PUBLIC_BASE_URL
- [ ] Ensure /api/podcasts/:id always returns stable audioUrl
- [ ] Test local dev unchanged (signed URLs)

**Step 2: Episode Endpoints**
- [ ] /api/podcasts/:id → stable audioUrl
- [ ] /api/audio/:id → persistent if public, signed fallback

**Step 3: Frontend Resilience**
- [ ] Preview.jsx: fetch error logging + UI fallback
- [ ] Episodes.jsx: audio fetch error handling

**Step 4: Transcript/Chapters Analysis**
- [ ] Verify if transcript affected by same expiry
- [ ] Fix specific cause

**Step 5: Render Config**
- [ ] Document exact R2_PUBLIC_BASE_URL format

**Step 6: Production Validation**
- [ ] Backend endpoints return stable URLs
- [ ] Audio loads after refresh
- [ ] No more 0:00 duration

**Step 7: Final Report**
- [ ] Changed files summary
- [ ] Root causes confirmed
- [ ] Render deployment steps


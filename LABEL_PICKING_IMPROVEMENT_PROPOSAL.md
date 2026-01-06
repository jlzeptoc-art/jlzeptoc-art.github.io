## Digital Label Picking System — Proposal (Presentation-Ready)

### Executive summary
- **What**: Replace paper label-picking schedules with a simple, touch-first digital schedule (iPad/browser).
- **Why**: Reduce wasted time (printing, math, rework), reduce errors, and improve visibility for both shifts.
- **Ask today**: Approve a short pilot on 1 iPad and agree on success metrics.

### Current pain points (what we see on the floor)
- **Printing + handling**: Schedules printed every shift; pages get lost/damaged; rollovers are harder to manage.
- **Manual bottle label math**: Case quantity × pack type is done by hand, which creates avoidable errors and rework.
- **No clear “picked” status**: Paper scratch-offs are easy to miss; there’s no quick progress view.
- **Hard to find label locations**: Rollover items require extra time (digging through papers or asking around).

### Proposed solution (what changes)
The digital schedule shows the same work list, but adds:
- **Automatic bottle label quantity calculation** (no manual math).
- **Tap-to-mark picked** for bottle / box / haz (clear green highlight).
- **Progress summary** (total items + % complete).
- **Source search** to find label locations for rollover/not-on-schedule items.
- **Shift-friendly** behavior: day sheets and “PM” sheets are selectable; picks are tracked per day.

### What it looks like in practice (1-minute demo flow)
- **Open schedule** → today auto-selects (or next available workday).
- **Pick bottle labels** → read calculated quantity under Ordered QTY → tap location when done.
- **Pick box labels** → tap location when done.
- **Haz labels** → only pick when Haz Info indicates corrosive (see quick guide).
- **Search Source** → type item # / description → get label locations instantly.

### Expected impact (time + quality)
Conservative estimate (can validate in pilot):
- **Printing eliminated**: ~10 minutes/day (two shifts).
- **Math + rework reduced**: ~10–20 minutes/day (fewer mis-picks + fewer recounts).
- **Faster rollovers/lookup**: ~5+ minutes/day.
- **Total**: **~25–35 minutes/day saved** plus fewer errors and fewer interruptions.

### Implementation plan (low risk)
- **Pilot (3–5 working days)**:
  - 1 iPad (or any device with a modern browser)
  - Run alongside paper for the first 1–2 days (backup)
  - Capture baseline vs pilot metrics
- **Rollout (week 2)**:
  - Bookmark link on iPad(s)
  - Short training (10–15 minutes per associate)
  - Transition to digital-first, paper as fallback

### Success metrics (what we’ll measure)
- **Pick completion time** (start → ready to stage)
- **Label picking errors / rework events**
- **Time spent on printing + handling schedules**
- **Associate feedback** (ease of use, clarity, confidence)

### Risks & mitigations
- **Device unavailable / battery**: keep 1 printed backup page for the shift (or use phone/PC).
- **Wi‑Fi issues**: keep local XLSX option; Google Sheet URL can be swapped in one config line when ready.
- **Adoption**: touch UI + quick guide + first-day coaching.

### Decision needed today
- **Approve pilot** on 1 iPad
- **Agree on metrics** above and a quick check-in after the pilot
- **Confirm owner** for schedule source (local XLSX vs Google Sheet link)

### Contact
- **J.L.** — Lean Manufacturing Specialist  
- **Email**: _[add your email]_  
- **Phone**: _[add your phone]_  

### Appendix: Feature comparison (at-a-glance)
| Area | Current (Paper) | Proposed (Digital) |
|---|---|---|
| Bottle label qty | Manual math | Auto-calculated |
| Pick tracking | Scratch-off | Tap-to-pick highlight |
| Progress visibility | None | Live summary |
| Rollover lookups | Slow | Source search |
| Printing | Daily | Optional / fallback only |


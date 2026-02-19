# UI/UX Backlog (100 Improvements)

This file tracks concrete UI/UX upgrades for the Flutter APK, aligned with Material 3 and adaptive Android layouts.

1. [DONE] Align Flutter color palette with the Next.js "Orbit" preset (primary/secondary/background/surface/border).
2. [DONE] Add a multi-layer app background (linear gradient + glow + subtle dot grid).
3. [DONE] Constrain panel content width on tablets/desktop for readability (max width).
4. [DONE] Replace fragile numeric parsing in Dashboard/Analytics with safe parsing helpers to avoid white screens.
5. [DONE] Upgrade dashboard KPI cards to a consistent KPI tile component.
6. [DONE] Unify panel headers with consistent spacing, weight hierarchy, and action placement.
7. [DONE] Add skeleton loading states (shimmer-less, lightweight) for each panel instead of only spinners.
8. [PLANNED] Add empty-state actions per panel (primary + secondary) with clear next steps.
9. [PLANNED] Add inline error banners (non-blocking) for partial data failures (e.g., "some items failed to load").
10. [PLANNED] Add pull-to-refresh affordance text/animation on first use.

11. [PLANNED] Adaptive layout: two-column layout for Dashboard cards on >= 840dp, three-column on >= 1200dp.
12. [PLANNED] Adaptive layout: Tasks list becomes a grid with consistent card widths and gutters.
13. [PLANNED] Adaptive layout: Accounts/Executions use split view (list + details) on large screens.
14. [PLANNED] Adaptive layout: Settings becomes a two-pane list/detail on large screens.
15. [PLANNED] Add safe-area aware bottom padding for gesture navigation devices.
16. [PLANNED] Add keyboard-aware scrolling for forms (avoid hidden buttons).
17. [PLANNED] Add state restoration for selected tab and scroll positions.
18. [PLANNED] Add fast, consistent transitions between panels (fade/slide + slight scale).
19. [PLANNED] Add motion spec: stagger card reveals on first load (no jank).
20. [PLANNED] Add haptic feedback for key actions (toggle, run, delete) with platform checks.

21. [PLANNED] Typography pass: define a full text scale (display/title/body/label) with consistent weights.
22. [PLANNED] Increase legibility: ensure minimum contrast for disabled/secondary text in both themes.
23. [PLANNED] Use consistent icon size system (16/20/24) with alignment rules.
24. [PLANNED] Define spacing tokens (4/8/12/16/24) and replace magic numbers gradually.
25. [PLANNED] Add consistent card "header row" pattern (title + meta + actions).
26. [PLANNED] Add pill/chip system for statuses with consistent tones and semantics.
27. [PLANNED] Add “glass toolbar” polish: better translucency and subtle border under blur.
28. [PLANNED] Add tactile button states (pressed feedback) for Filled/Outlined buttons.
29. [PLANNED] Add consistent dividers and section separators (avoid visual noise).
30. [PLANNED] Add subtle elevation in light theme only; keep dark theme flat + glow.

31. [PLANNED] Dashboard: add "Today / 7d / 30d" scope switch for KPIs.
32. [PLANNED] Dashboard: add a compact trend indicator (up/down) for success rate.
33. [PLANNED] Dashboard: replace long lists with "top 5 + view all" pattern consistently.
34. [PLANNED] Dashboard: highlight OAuth warnings with a dedicated callout card.
35. [PLANNED] Dashboard: add platform distribution mini-bars (no external chart lib).
36. [PLANNED] Dashboard: add a “Quick actions” strip (Create task, Connect account, View logs).
37. [DONE] Dashboard: show last refresh time and stale-data indicator.
38. [PLANNED] Dashboard: add "System health" summary badges (latency/errors) when available.
39. [PLANNED] Dashboard: add a compact "recent failures" list.
40. [PLANNED] Dashboard: add a dedicated empty dashboard illustration (vector-free, icon-based).

41. [PLANNED] Tasks: add a single “Create task” FAB on phones (contextual).
42. [DONE] Tasks: add filter chips row (Status, Platform, Last run, Issues) with counts.
43. [PLANNED] Tasks: add saved filter presets ("channels") for power users.
44. [PLANNED] Tasks: add “Bulk actions” (pause/resume/delete) with multi-select UI.
45. [PLANNED] Tasks: add sorting controls in a bottom sheet on mobile.
46. [PLANNED] Tasks: improve “Last run” formatting and add next scheduled run (if available).
47. [PLANNED] Tasks: show execution failure reason inline with truncation and "view details".
48. [PLANNED] Tasks: add "Run now" confirmation for high-risk tasks.
49. [DONE] Tasks: add "Duplicate task" action.
50. [PLANNED] Tasks: add “Task health” score (computed) with explanation tooltip.

51. [PLANNED] Task editor: split form into steps (Basics, Sources, Targets, Content, Review).
52. [PLANNED] Task editor: add searchable account picker with platform chips.
53. [PLANNED] Task editor: prevent selecting same account as both source and target (clear UX).
54. [PLANNED] Task editor: add inline validation summary at top on submit.
55. [PLANNED] Task editor: add “Test run” option before saving.
56. [PLANNED] Task editor: add content preview (text/image/video/link).
57. [PLANNED] Task editor: add schedule UI (cron-like presets) if backend supports.
58. [PLANNED] Task editor: support draft saving locally (SharedPreferences).
59. [PLANNED] Task editor: add “Advanced” section (retries, rate limits) if backend supports.
60. [PLANNED] Task editor: add accessibility labels for every form control.

61. [PLANNED] Accounts: group by platform with collapsible sections.
62. [PLANNED] Accounts: show connection health signal (ok/warn/error) with explanation.
63. [PLANNED] Accounts: add “Reconnect” action for inactive/OAuth-warning accounts.
64. [PLANNED] Accounts: add account details sheet (name, username, created, last activity).
65. [PLANNED] Accounts: add quick filters (Active, Inactive, Needs auth).
66. [PLANNED] Accounts: add platform icons that match brand shapes (abstracted, not logos).
67. [PLANNED] Accounts: add skeleton loading list.
68. [PLANNED] Accounts: add empty-state direct deep link hint to web dashboard.
69. [DONE] Accounts: add “copy username” action.
70. [PLANNED] Accounts: add “open platform profile” action if URL exists.

71. [DONE] Executions: add status filter chips (Success, Failed, Running, Pending).
72. [DONE] Executions: add search debounce (reduce rebuilds on every keypress).
73. [DONE] Executions: add details view with logs, payload, and error stack.
74. [DONE] Executions: add "retry execution" (if backend supports).
75. [DONE] Executions: add "copy error" and "share report" actions.
76. [DONE] Executions: add timeline rendering (queued -> running -> done).
77. [DONE] Executions: show source/target accounts with platform chips.
78. [DONE] Executions: add pagination/infinite scroll with visible loading footer.
79. [PLANNED] Executions: add offline indicator and cached last view.
80. [DONE] Executions: add performance metrics (duration) if available.

81. [PLANNED] Analytics: add timeframe selector and compare-to-previous period.
82. [DONE] Analytics: add simple bar chart for task success rates (CustomPaint).
83. [PLANNED] Analytics: add failure category breakdown (network/auth/content).
84. [PLANNED] Analytics: add per-platform analytics view.
85. [DONE] Analytics: add export CSV for analytics.
86. [PLANNED] Analytics: add explanation tooltips (what each KPI means).
87. [PLANNED] Analytics: ensure all numbers are formatted locale-aware.
88. [PLANNED] Analytics: highlight anomalies (sudden drop in success rate).
89. [PLANNED] Analytics: add "top errors" list.
90. [PLANNED] Analytics: add "recommendations" card (auto-suggest improvements).

91. [DONE] Settings: add “Theme preset” selector (Orbit/Graphite/Sunrise/Nord/Ocean/Warm Luxe) to mirror Next.js presets.
92. [DONE] Settings: add “Reduce motion” toggle and honor it across animations.
93. [PLANNED] Settings: add “Text size” scaling and preview.
94. [PLANNED] Settings: add “Diagnostics” page (build, API, device, last sync).
95. [PLANNED] Settings: add “Privacy” section with clear permissions explanation.
96. [PLANNED] Settings: add “Notification preferences” (if supported).
97. [PLANNED] Settings: add “About” page with versioning and links.
98. [PLANNED] Global: add accessibility pass (semantics, focus order, minimum tap targets).
99. [PLANNED] Global: add performance pass (repaint boundaries, image caching, list virtualization).
100. [PLANNED] Global: add UI regression checklist and screenshots per panel.

# Flutter APK UI/UX Audit (100 Current Gaps vs Next.js)

Audit scope (code-based):
- Flutter mobile shell and panels: `flutter_app/lib/main.dart`
- Web reference UX: `components/layout/header.tsx`, `components/layout/global-shell-enhancements.tsx`, `app/tasks/page.tsx`, `components/tasks/task-wizard.tsx`, `app/executions/page.tsx`, `app/settings/page.tsx`

Audit date: 2026-02-19.

1. Flutter has no global command palette equivalent to the web `Ctrl/Cmd + K` workflow.
2. Flutter has no keyboard-shortcuts help modal equivalent to web `Shift + ?`.
3. Flutter has no global quick-actions menu/FAB equivalent to the web shell enhancement.
4. Flutter has no "What's New" modal surface for release-level operator updates.
5. Flutter has no "recently viewed" navigation surface.
6. Flutter panel state is not URL-routed, so views are not deep-linkable/shareable like web routes.
7. Flutter sidebar omits per-item captions used in web navigation for faster scanning.
8. Flutter header does not show breadcrumbs.
9. Flutter has no global offline banner equivalent to the web shell offline state.
10. Flutter has no route progress indicator equivalent to web route-change progress.
11. Flutter has no global top search entry point that opens a cross-app command/search surface.
12. Flutter has no global profile modal from header with inline edit/logout parity.
13. Flutter mobile nav lacks the web-style quick menu actions cluster.
14. Flutter has no dedicated quick-search header action icon parity.
15. Flutter has no app-wide keyboard shortcut bindings for operator speed workflows.

16. Flutter still mixes multiple component styles (`Card`, `ListTile`, custom SF widgets) in one surface.
17. Spacing remains partly hard-coded across sections instead of fully tokenized.
18. Icon sizing is inconsistent across cards, chips, and row actions.
19. Status tones are not fully normalized to one semantic system matching web token behavior.
20. Panel motion choreography is not at the same polish level as web stagger/fade patterns.
21. Header composition differs between panels, reducing visual rhythm consistency.
22. Corner-radius usage varies across tiles, cards, chips, and modal sections.
23. Badge/chip visual language is not fully unified across all panels.
24. Search/filter blocks are not sticky on long-scroll sections.
25. Skeleton states are implemented, but not uniformly across all panels and states.
26. Error communication pattern is mixed (snackbar vs inline) rather than standardized.
27. Density behavior does not yet match web compactness expectations on large screens.
28. Desktop-hover affordances are less explicit than web for interactive rows/actions.
29. Typography hierarchy is still less strict than web's title/subtitle/body rhythm.
30. There is no single shared cross-platform token contract mirroring web theme tokens.

31. Dashboard lacks timeframe switching (Today/7d/30d).
32. Dashboard lacks KPI trend arrows/delta indicators.
33. Dashboard lacks a dedicated OAuth-attention callout block like web.
34. Dashboard lacks a dedicated recent-failures module.
35. Dashboard lacks a compact quick-actions strip in the hero area.
36. Dashboard lacks platform distribution mini-bars/summary visuals.
37. Dashboard lacks task health scoring/presentation.
38. Dashboard lacks a prominent pending-executions operational alert tile.
39. Dashboard lacks a release/update announcement widget.
40. Dashboard cards do not all provide equivalent deep links and next actions as web.
41. Dashboard does not support user-level widget pinning/reordering.
42. Dashboard lacks a panel-level export shortcut surface.
43. Dashboard lacks a condensed "operator glance" mode for dense monitoring.
44. Dashboard lacks consistent KPI explanation tooltips.
45. Dashboard lacks refresh cadence controls (auto-refresh strategy options).

46. Flutter has no dedicated route-based tasks page with URL-persisted filters.
47. Flutter task creation is not parity with web `TaskWizard` stepper workflow.
48. Flutter task editing is not parity with web route-based wizard editing.
49. Flutter lacks task detail page parity (`app/tasks/[id]/page.tsx`).
50. Flutter lacks task-level analytics block shown in web detail.
51. Flutter lacks task error-analysis/failure-prediction surfaces present in web details.
52. Flutter lacks full schedule/recurrence UX parity with wizard depth.
53. Flutter lacks full platform-specific advanced controls parity (Twitter/Telegram/YouTube branches).
54. Flutter task rows do not expose web-level auth-warning density and context.
55. Flutter lacks multi-select bulk task operations (pause/resume/delete).
56. Flutter lacks saved filter presets/channels.
57. Flutter task sorting/filtering controls are less expressive than web's full control set.
58. Flutter task rows show less dense operational metadata than web cards.
59. Flutter confirmation UX is not standardized to a shared confirm-dialog pattern.
60. Flutter lacks per-task export/report shortcuts available through web flows.
61. Flutter "open task logs" uses local panel state, not URL-backed task-scoped execution routing.
62. Flutter lacks rich pre-submit transformation previews.
63. Flutter task composer lacks draft autosave/restore.
64. Flutter task form lacks full step-level validation summary UX.
65. Flutter task creation/edit workflows are less keyboard-efficient than web.

66. Flutter has no OAuth account-connect flow UI.
67. Flutter has no manual account add/edit UI parity with web account forms.
68. Flutter has no disconnect/delete account action in accounts panel.
69. Flutter has no reconnect action for inactive or expired-auth accounts.
70. Flutter has no auth-method badgeing (OAuth/manual/session) on account rows.
71. Flutter has no dedicated account details drawer/sheet parity with web depth.
72. Flutter does not expose re-auth reason/required-at signals per account.
73. Flutter account filtering is narrower than web account-management flows.
74. Flutter accounts panel has no backend pagination/load-more control parity.
75. Flutter has no route-level account management pages (connect/edit) parity.

76. Flutter executions lack SSE/EventSource real-time updates.
77. Flutter executions lack grouped-run view by execution group id.
78. Flutter executions lack explicit sort controls (`executedAt/status/taskName`).
79. Flutter executions have no URL task filter/deep link parity.
80. Flutter executions panel lacks CSV export action parity.
81. Flutter executions do not implement dynamic polling strategy based on pending state.
82. Flutter executions do not implement app-focus visibility refresh behavior parity.
83. Flutter executions lack grouped expand/collapse route detail rows.
84. Flutter executions lack top stats cards based on grouped runs.
85. Flutter executions lack grouped error aggregation summaries.
86. Flutter executions have no permalink/shareable route to a specific run.
87. Flutter executions have no batch retry action by group.
88. Flutter executions lack explicit processing-run KPI parity.

89. Flutter analytics lacks timeframe selector parity.
90. Flutter analytics lacks compare-to-previous-period metrics.
91. Flutter analytics lacks per-platform breakdown parity.
92. Flutter analytics lacks failure-category breakdown parity.
93. Flutter analytics lacks anomaly/recommendation insight cards.
94. Flutter analytics rows lack direct contextual actions (open task/open logs).
95. Flutter analytics lacks explicit stale/cache-state signaling parity.

96. Flutter settings has no single "Save All Changes" action parity.
97. Flutter settings lacks explicit unsaved-changes leave guard across all editable sections.
98. Flutter lacks a dedicated diagnostics screen with runtime/build/network detail parity.
99. Flutter lacks an "About / release notes" section parity.
100. Flutter UI remains highly monolithic (`lib/main.dart`), making parity iteration and regression control harder than the modular web architecture.

# Dark Mode CSS Variable Fix — CC Handoff
# Precise in-place edits based on actual source review.
# Dev team compliance — zero hardcoded hex in component styles.
# Run ng build after each step.

=================================================================
## STEP 1 — Add semantic variables to styles.css
=================================================================

In client-angular/src/styles.css

ADD to the :root { } block after --color-text-muted:

  /* Status colours — semantic, dark mode aware */
  --color-action-bg:      #FEF2F2;
  --color-action-text:    #DC2626;
  --color-action-border:  #FECACA;
  --color-waiting-bg:     #FFFBEB;
  --color-waiting-text:   #D97706;
  --color-waiting-border: #FDE68A;
  --color-quoted-bg:      #EFF6FF;
  --color-quoted-text:    #2563EB;
  --color-quoted-border:  #BFDBFE;
  --color-booked-bg:      #ECFDF5;
  --color-booked-text:    #059669;
  --color-booked-border:  #6EE7B7;
  --color-msg-read-bg:    #F3F4F6;
  --color-msg-read-border:#E5E7EB;
  --color-msg-out-bg:     #FEFCF0;
  --color-msg-out-border: #FDE68A;
  --color-thread-bg:      #F9FAFB;
  --color-unread-row-bg:  #FEFCF8;
  --color-tier-bg:        #EDE9FE;
  --color-tier-text:      #5B21B6;
  --color-tier-border:    #8B5CF6;

ADD to [data-mode="dark"] { } block:

  --color-action-bg:      #2D1515;
  --color-action-text:    #F87171;
  --color-action-border:  #7F1D1D;
  --color-waiting-bg:     #2D2008;
  --color-waiting-text:   #FCD34D;
  --color-waiting-border: #78350F;
  --color-quoted-bg:      #0F1D35;
  --color-quoted-text:    #93C5FD;
  --color-quoted-border:  #1E3A5F;
  --color-booked-bg:      #0A2018;
  --color-booked-text:    #6EE7B7;
  --color-booked-border:  #064E3B;
  --color-msg-read-bg:    #1A1A1A;
  --color-msg-read-border:#2A2A2A;
  --color-msg-out-bg:     #2A2218;
  --color-msg-out-border: #3D3020;
  --color-thread-bg:      #111111;
  --color-unread-row-bg:  #1A1810;
  --color-tier-bg:        #1E1535;
  --color-tier-text:      #C4B5FD;
  --color-tier-border:    #4C1D95;

ALSO in styles.css — fix the INBOX CARD STYLE section:
  .bp-inbox-card { background: #fff ... }
  → background: var(--color-surface)

=================================================================
## STEP 2 — Fix messages-inbox.component.ts
=================================================================

File: client-angular/src/app/shared/components/messages-inbox/messages-inbox.component.ts

In the styles array, make these replacements:

  background:#FEFCF8                    → background:var(--color-unread-row-bg)
  background:#F9FAFB                    → background:var(--color-thread-bg)
  background:#F3F4F6                    → background:var(--color-msg-read-bg)
  background:#FEFCF0                    → background:var(--color-msg-out-bg)
  border-color:#E5E7EB                  → border-color:var(--color-msg-read-border)
  border-color:#FDE68A (in msg-out)     → border-color:var(--color-msg-out-border)
  background:#FEF2F2                    → background:var(--color-action-bg)
  border-color:#FECACA                  → border-color:var(--color-action-border)
  color:#DC2626                         → color:var(--color-action-text)
  background:#FFFBEB                    → background:var(--color-waiting-bg)
  color:#D97706 (in badge/cat only)     → color:var(--color-waiting-text)
  background:#EFF6FF                    → background:var(--color-quoted-bg)
  border-color:#BFDBFE                  → border-color:var(--color-quoted-border)
  color:#2563EB                         → color:var(--color-quoted-text)
  background:#ECFDF5                    → background:var(--color-booked-bg)
  border-color:#6EE7B7                  → border-color:var(--color-booked-border)
  color:#059669                         → color:var(--color-booked-text)

  .bp-msg-status-pill background:#fff   → background:var(--color-surface)
  .bp-msg-status-pill.active fallback:
    var(--pill-color,#111827)           → var(--pill-color,var(--color-text-primary))

  .bp-msg-folders background:#fff       → background:var(--color-surface)
  .bp-vendor-row background:#fff        → background:var(--color-surface)
  .bp-compose background:#fff           → background:var(--color-surface)
  .bp-status-tag background:#fff        → background:var(--color-surface)

  .bp-accepted-tag:
    background:#ECFDF5                  → background:var(--color-booked-bg)
    color:#059669                       → color:var(--color-booked-text)
    border:0.5px solid #6EE7B7         → border:0.5px solid var(--color-booked-border)

  LEAVE AS-IS (intentional):
    linear-gradient(160deg, #1a1a2e, #16213e)  — decorative avatar bg
    #E11D48  — heart fill/stroke
    color:#fff in .bp-send-btn, .bp-accept-btn — text on solid bg, valid exception
    Hex values inside the STATUSES const array — these feed CSS custom props, not rendered directly

=================================================================
## STEP 3 — Fix supplier-list.component.ts
=================================================================

File: client-angular/src/app/features/suppliers/supplier-list.component.ts

  .bp-sup-tag background: #fff          → background: var(--color-surface)
  Any other background:#fff in styles   → background: var(--color-surface)

=================================================================
## STEP 4 — Fix item-detail.component.ts
=================================================================

File: client-angular/src/app/features/suppliers/item-detail.component.ts

  .bp-item-tag-tier:
    background: #EDE9FE                 → background: var(--color-tier-bg)
    color: #5B21B6                      → color: var(--color-tier-text)
    border-color: #8B5CF6               → border-color: var(--color-tier-border)

=================================================================
## STEP 5 — Update WORKING_STANDARDS.md
=================================================================

In WORKING_STANDARDS.md, add to the Design Tokens section:

  /* Status + message colours — always use vars, never hardcode */
  --color-action-bg / text / border
  --color-waiting-bg / text / border
  --color-quoted-bg / text / border
  --color-booked-bg / text / border
  --color-msg-read-bg / border
  --color-msg-out-bg / border
  --color-thread-bg
  --color-unread-row-bg
  --color-tier-bg / text / border

=================================================================

ng build
git add .
git commit -m "fix: replace hardcoded hex with CSS variables — dark mode compliant, dev-team ready"
git push origin dev

# inbox-v2 — Component Schematic

Living spec. Update whenever a layer is added/changed. Headings fold with +/- in Notepad++.

Legend:
- `[global: x]` — imported / shared chrome, no per-page CSS
- `[local]` — unique to this component

---

## hero  `[global: app-shell]`

### back
- source: `route.data.back`

### title
- source: `route.data.heroTitle`
- overridden by: page-settings

### subtitle
- source: `route.data.heroSub`
- overridden by: page-settings

### align
- source: `route.data.heroAlign`
- overridden by: page-settings

### page-settings (cog)
- `[global: HeroSettingsService + ConfigService]`

---

## search-row  `[global: .bp-search-row CSS]`

### search-input  `[global: .bp-search-input + pInputText]`
- ngModel → `searchTerm`

### filter-button  `[global: .bp-search-filter-btn]`
- badge → `activeFilterCount()`
- (click) → `filterOpen = !filterOpen`

---

## filter-drawer  `[global: p-sidebar styleClass="bp-drawer"]`

### client-dropdown
- timing: load-time
- model: `selectedClientId`

### project-dropdown
- timing: load-time
- model: `selectedProjectId`

### category-dropdown
- timing: post-load
- model: `activeFolder`

### contact-dropdown
- timing: post-load
- model: `activeSupplier`

### status-dropdown
- timing: post-load
- model: `activeStatus`

---

## body  `[local]`

### tree-rail (left)  `[local]`

Thread list, hierarchical: Project → Supplier → Item

#### project-card  `[local]`

##### header
- project name + count + expand chevron

##### supplier-row  `[local]`  (visible when project expanded)

###### header
- supplier name + count + expand chevron

###### item-thread-row  `[local]`  (visible when supplier expanded)
- `item-name` → `selectedItemId`
- `latest-snippet` — truncated body of latest message
- `timestamp` — relative ("2h", "Yesterday")
- `unread-badge` — count, hidden if 0

### thread-pane (right)  `[local]`

Per-item conversation.

#### thread-header  `[local]`
- `breadcrumb` — Project › Supplier › Item
- `status-pill` — open / closed / awaiting

#### quoted-item-card  `[local]`

Pinned at top.

- `thumbnail`
- `item-name + price`
- `decision-state` — pending / accepted / rejected

#### message-list  `[local]`

Scrollable.

##### message-bubble  `[global: .bp-msg-bubble CSS]`
- `avatar`
- `sender-name + timestamp`
- `body` — text / attachments
- `decision-action` — accept / counter / reject (when applicable)

#### compose-bar  `[local]`

Pinned at bottom.

- `textarea` — `[global: .bp-compose-input]`
- `attach-button` — paperclip icon
- `send-button` — `[global: .bp-btn-primary]`

---

## status

- **Built so far:** hero, search-row
- **Sketched (not yet coded):** filter-drawer, tree-rail, thread-pane
- **Next to code:** filter-drawer → tree-rail → thread-pane

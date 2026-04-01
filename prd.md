# 🔥 FRONTEND PRD — CitySketch X (ChatGPT-style UI)

---

# 1. 🎯 Product Goal (Frontend POV)

Build a **clean, professional SaaS interface** where:

* User inputs prompt (like ChatGPT)
* System generates **city layout visualization (2D/3D)**
* UI feels:

  * fast
  * minimal
  * structured
  * non-AI-looking

👉 The UI should feel like:

* ChatGPT
* Linear

NOT like Dribbble fantasy.

---

# 2. 🧱 Layout Architecture

## Global Layout

```text
-------------------------------------------------
| Top Bar (optional, very minimal)              |
-------------------------------------------------
| Sidebar (fixed) | Main Workspace              |
|                 |                             |
|                 |                             |
|                 |                             |
-------------------------------------------------
| Bottom Chat Input (fixed)                     |
-------------------------------------------------
```

---

## 2.1 Sidebar (LEFT — 240–280px)

### Purpose:

* Navigation + history

### Sections:

#### 1. Logo / App Name

* "CitySketch"
* small, top-left

#### 2. History List

* Previous prompts
* Clickable items
* Scrollable

#### 3. Settings (bottom)

* Minimal

---

### Behavior:

* Fixed position
* Independent scroll
* Hover highlight on items

---

## 2.2 Main Workspace (RIGHT — primary)

### Purpose:

👉 THIS is your product

---

### Structure:

#### Top Bar (inside workspace)

* Project name

* View toggles:

  * 2D
  * 3D
  * Code

* Optional:

  * fullscreen button
  * copy button

---

#### Canvas Area (CORE)

* Takes ~85–90% height
* Centered
* Large container

---

### Modes:

#### 2D Mode

* Grid layout
* Colored cells
* Clickable

#### 3D Mode

* Three.js canvas
* Same data mapped

#### Code Mode

* JSON / layout output

---

### Behavior:

* Smooth switching between modes
* No page reload
* Preserve state

---

## 2.3 Bottom Input Bar (Chat-style)

### Purpose:

👉 Primary interaction system

---

### Structure:

* Text input (full width)
* Left: "+" button (optional)
* Right:

  * mic icon
  * submit button

---

### Behavior:

* Fixed bottom
* Auto-resize textarea
* Enter → submit
* Shift+Enter → new line

---

# 3. 🎨 Design System

---

## 3.1 Theme

### Mode:

* Dark (default)

### Colors:

* Background: `#0b0f14`
* Sidebar: `#0f172a`
* Panels: `#111827`
* Borders: `#1f2937`

### Accent:

* Blue (`#3b82f6`) or Indigo

---

## 3.2 Typography

* Font: Inter
* Scale:

  * Heading: 16–18px
  * Body: 14px
  * Labels: 12px

---

## 3.3 Spacing

* 8px system
* Standard paddings:

  * 16px
  * 24px
  * 32px

---

## 3.4 Components Style Rules

* Border radius: 12px–16px
* Shadows: minimal
* Use borders instead of glow

---

# 4. ⚙️ State Management

Use:

* Zustand OR React Context

---

## Core State:

```ts
{
  prompt: string,
  layoutData: GridCell[][],
  selectedCell: GridCell | null,
  viewMode: "2D" | "3D" | "CODE",
  isLoading: boolean,
  history: string[]
}
```

---

# 5. 🧩 Component Architecture

---

```text
<App>
  <Sidebar />
  <MainWorkspace>
    <WorkspaceHeader />
    <Canvas>
      <Grid2D />
      <Scene3D />
      <CodeView />
    </Canvas>
  </MainWorkspace>
  <ChatInput />
</App>
```

---

# 6. 🎞️ Animations (STRICT RULES)

---

## Allowed:

### 1. Fade-in

* opacity 0 → 1
* translateY 8px → 0

---

### 2. Hover

* slight background change
* max scale: 1.02

---

### 3. Layout transitions

* smooth switching views

---

## NOT ALLOWED:

❌ bounce
❌ glow
❌ flashy motion
❌ parallax

---

# 7. ⚡ Interactions

---

## Chat Flow:

1. User enters prompt
2. Click "Generate"
3. Show loading state
4. Render grid
5. Allow interaction

---

## Grid Interaction:

* Hover → highlight cell
* Click → update explanation panel (future)

---

# 8. 📦 Tech Stack

---

## Required:

* React (Vite)
* Tailwind CSS
* Zustand
* Framer Motion (light usage)

---

## Optional:

* React Three Fiber (for 3D)

---

# 9. 🚫 Anti-Patterns (READ THIS CAREFULLY)

---

### DO NOT:

* Mix too many UI styles
* Use random gradients
* Over-round everything
* Add unnecessary cards
* Add fake data widgets

---

# 10. 🧠 Development Phases

---

## Phase 1 (YOU ARE HERE)

* Layout only
* Background
* Sidebar + canvas

---

## Phase 2

* Chat input

---

## Phase 3

* Grid (2D)

---

## Phase 4

* 3D

---

## Phase 5

* AI integration

---
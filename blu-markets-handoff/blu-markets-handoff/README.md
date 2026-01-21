# Blu Markets Mobile App — Development Handoff Package

## 📦 Package Contents

```
blu-markets-handoff/
├── README.md                    # This file
├── CLAUDE_CODE_HANDOFF.md       # Complete development guide
├── SCREEN_INVENTORY.md          # Screen-to-mockup file mapping
├── design-tokens.ts             # Design system tokens (TypeScript)
├── questionnaire.fa.json        # Farsi risk questionnaire data
└── engine/                      # Business logic (copy from React web)
    ├── boundary.ts
    ├── portfolioStatus.ts
    ├── preview.ts
    ├── pricing.ts
    ├── riskScoring.js
    └── snapshot.ts
```

---

## 🚀 Quick Start for Claude Code

### 1. Initialize Project

```bash
npx create-expo-app BluMarkets --template expo-template-blank-typescript
cd BluMarkets
```

### 2. Install Dependencies

```bash
# Navigation
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context

# State Management
npm install zustand

# UI Components
npm install react-native-reanimated react-native-gesture-handler
npm install @gorhom/bottom-sheet

# Utilities
npm install date-fns
```

### 3. Copy Files

1. Copy `design-tokens.ts` to `src/constants/`
2. Copy `questionnaire.fa.json` to `src/data/`
3. Copy `engine/` files to `src/engine/`

### 4. Start Development

```bash
npx expo start
```

---

## 📋 Development Priorities

### Phase 1: Core MVP (P0) — Week 1-2

1. ✅ Project setup and navigation structure
2. ✅ Design system implementation
3. 🔲 Onboarding flow (8 screens)
4. 🔲 Chat-First Dashboard
5. 🔲 Basic trade flow

### Phase 2: Features (P1) — Week 3-4

6. 🔲 History tab (full ledger)
7. 🔲 Protection flow
8. 🔲 Loans flow
9. 🔲 Profile settings

### Phase 3: Polish (P2) — Week 5

10. 🔲 Empty states
11. 🔲 Error handling
12. 🔲 Loading states
13. 🔲 Animations

---

## ⚠️ Critical Requirements

### Must Use Farsi

| Screen | Content |
|--------|---------|
| Risk Questionnaire | All questions and answers |
| Consent Screen | Acknowledgment text |

### Bottom Navigation (Standardize)

All screens MUST use:
```
Home | Portfolio | Market | History | Profile
```

### Allocation Labels (Correct)

Use:
```
Foundation (blue) | Growth (purple) | Upside (green)
```

NOT:
```
Crypto | Stocks | Cash ❌
```

---

## 📁 Reference Files

| File | Location | Purpose |
|------|----------|---------|
| PRD | User uploads | Source of truth for features |
| React Web Codebase | User uploads | Engine logic reference |
| UI Mockups ZIP | User uploads | Visual design reference (34 screens) |

**Mockup ZIP filename:** `Blu_Markets_Mobile_App_UI_MockUps_-_Claude_Prompt_for_Stitch.zip`
| This Package | `/blu-markets-handoff/` | Development guide |

---

## 🎯 Key Architecture Decisions

### 1. Chat-First Dashboard
The Activity Feed is the HERO element — positioned at top, above portfolio value.

### 2. Three-Layer Portfolio Model
- **Foundation**: Stablecoins (low risk)
- **Growth**: BTC, ETH (moderate risk)
- **Upside**: Altcoins (high risk)

### 3. Boundary System
Every action is classified:
- **SAFE** (green): Aligns with target
- **DRIFT** (amber): Minor deviation
- **STRUCTURAL** (orange): Major deviation
- **STRESS** (red): High risk

### 4. Engine-First Architecture
Business logic in `/engine/` is pure TypeScript with no UI dependencies. Port directly from React web.

---

## 📞 Support

For questions about:
- **Product requirements**: Refer to PRD
- **Visual design**: Refer to UI mockups
- **Business logic**: Refer to React web codebase
- **Implementation**: Refer to `CLAUDE_CODE_HANDOFF.md`

---

**Ready to build! 🚀**

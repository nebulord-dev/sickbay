---
name: review-project
description: Review the Sickbay application for issues
---

Review ${0:-all packages} for bugs, security issues, and code quality problems. Focus on practical issues, not style nitpicks

1. Check the monorepo structure in packages/
2. Verify build configuration (Turbo, tsup, Vite)
3. Review the three main packages:
   - core: Analysis engine
   - cli: Terminal interface with Ink
   - web: React dashboard
4. Analyze data flow from core → cli → web
5. Suggest architectural improvements

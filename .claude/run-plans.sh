#!/bin/bash
for plan in .claude/plans/ready/*.md; do
  echo ""
  echo "=========================================="
  echo "Starting: $plan"
  echo "=========================================="
  echo ""
  claude -p "Execute the plan in $plan exactly as written. \
    Commit when done with a descriptive message." \
    --allowedTools "Read,Edit,Write,Bash(pnpm *),Bash(git *)" \
    --verbose
  echo ""
  echo "✓ Finished: $plan"
  echo ""
done
echo "All plans complete."

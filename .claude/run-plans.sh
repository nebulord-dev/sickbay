#!/bin/bash
for plan in .claude/plans/ready/*.md; do
  claude -p "Execute the plan in $plan exactly as written. \
    Commit when done with a descriptive message." \
    --allowedTools "Read,Edit,Write,Bash(pnpm *),Bash(git *)"
done

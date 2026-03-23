#!/usr/bin/env bash
set -euo pipefail

ANON_NAME="omotenashi-labs"
ANON_EMAIL="264079306+omotenashi-labs@users.noreply.github.com"

usage() {
  echo "Usage: scripts/commit-safe.sh \"commit message\" [paths-to-add...]"
  echo
  echo "Examples:"
  echo "  scripts/commit-safe.sh \"Docs: update MVP ownership spec\""
  echo "  scripts/commit-safe.sh \"Docs: refine intake flow\" docs/ README.md"
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

MESSAGE="$1"
shift || true

if [[ $# -gt 0 ]]; then
  git add "$@"
else
  git add -A
fi

if git diff --cached --quiet; then
  echo "No staged changes to commit."
  exit 1
fi

GIT_AUTHOR_NAME="$ANON_NAME" \
GIT_AUTHOR_EMAIL="$ANON_EMAIL" \
GIT_COMMITTER_NAME="$ANON_NAME" \
GIT_COMMITTER_EMAIL="$ANON_EMAIL" \
git commit -m "$MESSAGE"

echo
echo "Latest commit identity:"
git log -1 --format='%h %s%nAuthor: %an <%ae>%nCommitter: %cn <%ce>'

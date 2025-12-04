#!/bin/bash
# Git Water Workflow - Sync branches when things get out of sync
# Usage: ./scripts/git-water.sh [command]
#
# Commands:
#   sync     - Sync staging with main (default)
#   status   - Show branch status
#   rescue   - Rescue uncommitted changes, then sync
#   help     - Show this help

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

show_status() {
  echo ""
  log_info "Current branch status:"
  echo ""
  
  git fetch origin --quiet
  
  local current=$(git branch --show-current)
  echo -e "  Current branch: ${GREEN}$current${NC}"
  echo ""
  
  # Show main status
  local main_local=$(git rev-parse main 2>/dev/null || echo "none")
  local main_remote=$(git rev-parse origin/main 2>/dev/null || echo "none")
  if [ "$main_local" = "$main_remote" ]; then
    echo -e "  main:    ${GREEN}up to date${NC}"
  else
    local behind=$(git rev-list --count main..origin/main 2>/dev/null || echo "0")
    local ahead=$(git rev-list --count origin/main..main 2>/dev/null || echo "0")
    echo -e "  main:    ${YELLOW}$behind behind, $ahead ahead${NC}"
  fi
  
  # Show staging status
  local staging_local=$(git rev-parse staging 2>/dev/null || echo "none")
  local staging_remote=$(git rev-parse origin/staging 2>/dev/null || echo "none")
  if [ "$staging_local" = "$staging_remote" ]; then
    echo -e "  staging: ${GREEN}up to date${NC}"
  else
    local behind=$(git rev-list --count staging..origin/staging 2>/dev/null || echo "0")
    local ahead=$(git rev-list --count origin/staging..staging 2>/dev/null || echo "0")
    echo -e "  staging: ${YELLOW}$behind behind, $ahead ahead${NC}"
  fi
  
  # Check if staging is behind main
  local staging_behind_main=$(git rev-list --count staging..main 2>/dev/null || echo "0")
  if [ "$staging_behind_main" != "0" ]; then
    echo ""
    log_warn "staging is $staging_behind_main commits behind main"
    echo -e "  Run ${GREEN}npm run git:sync${NC} to fix"
  fi
  
  # Check for uncommitted changes
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo ""
    log_warn "You have uncommitted changes"
  fi
  
  echo ""
}

sync_branches() {
  log_info "Starting water workflow - syncing staging with main..."
  echo ""
  
  # Check for uncommitted changes
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    log_error "You have uncommitted changes. Please commit or stash them first."
    echo ""
    echo "  Options:"
    echo "    1. Commit your changes: git add -A && git commit -m 'WIP'"
    echo "    2. Stash your changes:  git stash"
    echo "    3. Use rescue mode:     npm run git:rescue"
    echo ""
    exit 1
  fi
  
  # Fetch latest
  log_info "Fetching latest from origin..."
  git fetch origin
  log_success "Fetched"
  
  # Update main
  log_info "Updating main branch..."
  git checkout main
  git pull origin main
  log_success "main is up to date"
  
  # Rebase staging onto main
  log_info "Rebasing staging onto main..."
  git checkout staging
  
  # Try rebase, fall back to merge if conflicts
  if git rebase main; then
    log_success "Rebased staging onto main"
  else
    log_warn "Rebase had conflicts, aborting and trying merge..."
    git rebase --abort
    if git merge main -m "Merge main into staging"; then
      log_success "Merged main into staging"
    else
      log_error "Merge also had conflicts. Please resolve manually."
      exit 1
    fi
  fi
  
  # Push staging
  log_info "Pushing staging to origin..."
  git push origin staging --force-with-lease
  log_success "Pushed staging"
  
  # Switch back to main (usually where you want to work)
  git checkout main
  
  echo ""
  log_success "Water workflow complete! You're on main branch."
  echo ""
}

rescue_changes() {
  log_info "Rescue mode - saving your changes before sync..."
  echo ""
  
  # Check if there are changes to rescue
  if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
    log_info "No uncommitted changes to rescue. Running normal sync..."
    sync_branches
    return
  fi
  
  # Stash changes with a descriptive name
  local stash_name="water-rescue-$(date +%Y%m%d-%H%M%S)"
  log_info "Stashing changes as '$stash_name'..."
  git stash push -m "$stash_name"
  log_success "Changes stashed"
  
  # Run sync
  sync_branches
  
  # Pop the stash
  log_info "Restoring your changes..."
  if git stash pop; then
    log_success "Changes restored"
  else
    log_warn "Could not auto-restore changes (conflicts?)"
    echo "  Your changes are still in stash. Run: git stash pop"
  fi
  
  echo ""
}

show_help() {
  echo ""
  echo "Git Water Workflow 🌊"
  echo "====================="
  echo ""
  echo "When git branches get out of sync, this script helps you recover."
  echo ""
  echo "Usage:"
  echo "  npm run git:sync     Sync staging with main (rebase + push)"
  echo "  npm run git:status   Show branch status"
  echo "  npm run git:rescue   Stash changes, sync, then restore"
  echo ""
  echo "Typical workflow:"
  echo "  1. Work on main branch"
  echo "  2. Commit and push to main"
  echo "  3. Run 'npm run git:sync' to update staging"
  echo ""
  echo "If you accidentally worked on staging:"
  echo "  1. Run 'npm run git:rescue' to save your work"
  echo "  2. Or manually: git stash, then npm run git:sync, then git stash pop"
  echo ""
}

# Main
case "${1:-sync}" in
  sync)
    sync_branches
    ;;
  status)
    show_status
    ;;
  rescue)
    rescue_changes
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    log_error "Unknown command: $1"
    show_help
    exit 1
    ;;
esac

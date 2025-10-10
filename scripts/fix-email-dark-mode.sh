#!/bin/bash
# Fix email dark mode by adding !important to all color properties

# File list
FILES=(
  "src/lib/email/templates/patientSelection.ts"
  "src/lib/email/templates/patientConfirmation.ts"
  "src/lib/email/templates/patientUpdates.ts"
  "src/lib/email/templates/patientBlockerSurvey.ts"
  "src/lib/email/templates/therapistWelcome.ts"
  "src/lib/email/templates/therapistNotification.ts"
  "src/lib/email/templates/therapistReminder.ts"
  "src/lib/email/templates/therapistApproval.ts"
  "src/lib/email/templates/therapistRejection.ts"
  "src/lib/email/templates/therapistUploadConfirmation.ts"
  "src/lib/email/components/therapistPreview.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    
    # Add !important to color: properties (not already important)
    sed -i '' 's/color:\(#[0-9a-fA-F]\{3,8\}\);/color:\1 !important;/g' "$file"
    sed -i '' 's/color:\(rgb[a]\?([^)]*)\);/color:\1 !important;/g' "$file"
    
    # Add !important to background: linear-gradient (not already important)
    sed -i '' 's/background: linear-gradient(\([^;]*\));/background: linear-gradient(\1) !important;/g' "$file"
    sed -i '' 's/background-image: linear-gradient(\([^;]*\));/background-image: linear-gradient(\1) !important;/g' "$file"
    
    # Add !important to background: solid colors
    sed -i '' 's/background:\(#[0-9a-fA-F]\{3,8\}\);/background:\1 !important;/g' "$file"
    
    echo "  ✓ Done"
  else
    echo "  ✗ File not found: $file"
  fi
done

echo ""
echo "All files processed. Please review changes and test."

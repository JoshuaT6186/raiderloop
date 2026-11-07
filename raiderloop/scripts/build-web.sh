#!/usr/bin/env bash
# Builds the Flyer web app into hosting/app, then you deploy with:
#   firebase deploy --only hosting
# Run from the project folder.
set -e
rm -rf hosting/app
npx expo export --platform web --output-dir hosting/app
echo "Web app built in hosting/app. Next: firebase deploy --only hosting"

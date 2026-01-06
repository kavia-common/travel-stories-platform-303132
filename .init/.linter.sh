#!/bin/bash
cd /home/kavia/workspace/code-generation/travel-stories-platform-303132/travel_story_backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi


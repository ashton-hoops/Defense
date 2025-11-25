#!/bin/bash

# Create an AppleScript application that launches the command script
cat > /tmp/defense_launcher.applescript << 'ASCRIPT'
on run
    do shell script "cd /Users/ashtonjantz/Desktop/Defense && open -a Terminal.app start_defense_app.command"
end run
ASCRIPT

# Compile the AppleScript into an application
osacompile -o "OU Defense Analytics.app" /tmp/defense_launcher.applescript

echo "✅ Created OU Defense Analytics.app"
echo ""
echo "To add a custom icon:"
echo "1. Find a basketball/OU image you like"
echo "2. Copy it (Cmd+C)"
echo "3. Right-click 'OU Defense Analytics.app' → Get Info"
echo "4. Click the small icon in top-left of Info window"
echo "5. Paste (Cmd+V) to replace the icon"

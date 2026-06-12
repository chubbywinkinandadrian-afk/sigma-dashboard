#!/bin/bash
# ASHEN VOW — one-time Mac setup. Run after installing Xcode + Unreal Engine 5.
# Usage: ./Tools/setup_mac.sh
set -uo pipefail

PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"
UPROJECT="$PROJ_DIR/AshenVow.uproject"
echo "== ASHEN VOW setup =="
echo "Project: $UPROJECT"

# --- 1. Find the newest installed UE5 ---------------------------------------
UE_ROOT="$(ls -d "/Users/Shared/Epic Games"/UE_5.* 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "${UE_ROOT:-}" ]; then
  echo "ERROR: No Unreal Engine 5 found in '/Users/Shared/Epic Games/'."
  echo "Install the Epic Games Launcher, sign in, then Unreal Engine > Install (any 5.x)."
  exit 1
fi
UE_VER="$(basename "$UE_ROOT" | sed 's/^UE_//')"
echo "Engine:  $UE_ROOT (version $UE_VER)"

# --- 2. Require full Xcode ----------------------------------------------------
if ! xcode-select -p 2>/dev/null | grep -q "Xcode.app"; then
  if [ -d "/Applications/Xcode.app" ]; then
    echo "Xcode is installed but not selected. Run:"
    echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
    echo "  sudo xcodebuild -license accept"
  else
    echo "ERROR: Full Xcode is required to build UE C++ projects (Command Line Tools are not enough)."
    echo "Install Xcode from the App Store, then run the two commands above."
  fi
  exit 1
fi

# --- 3. Point the .uproject at the installed engine version ------------------
/usr/bin/python3 - "$UPROJECT" "$UE_VER" <<'PYEOF'
import json, sys
path, ver = sys.argv[1], sys.argv[2]
data = json.load(open(path))
short = ".".join(ver.split(".")[:2])
if data.get("EngineAssociation") != short:
    data["EngineAssociation"] = short
    json.dump(data, open(path, "w"), indent="\t")
    print(f"EngineAssociation -> {short}")
else:
    print(f"EngineAssociation already {short}")
PYEOF

# --- 4. Copy the Third Person mannequin content (mesh + anim BP) -------------
TPL="$UE_ROOT/Engine/Templates/TP_ThirdPerson/Content/Characters"
if [ -d "$TPL" ] && [ ! -d "$PROJ_DIR/Content/Characters" ]; then
  mkdir -p "$PROJ_DIR/Content"
  cp -R "$TPL" "$PROJ_DIR/Content/Characters"
  echo "Copied mannequin content from the Third Person template."
elif [ -d "$PROJ_DIR/Content/Characters" ]; then
  echo "Mannequin content already present."
else
  echo "WARN: template characters not found at $TPL — BPs will be created without a visible mesh."
fi

# --- 5. Build the editor target ----------------------------------------------
echo "== Building AshenVowEditor (first build takes a while) =="
"$UE_ROOT/Engine/Build/BatchFiles/Mac/Build.sh" AshenVowEditor Mac Development \
  -project="$UPROJECT" -waitmutex
BUILD_RC=$?
if [ $BUILD_RC -ne 0 ]; then
  echo "ERROR: build failed (exit $BUILD_RC). Fix compile errors and re-run."
  exit $BUILD_RC
fi

# --- 6. Run the in-editor setup script (map + Blueprints) --------------------
echo "== Creating map and Blueprints =="
"$UE_ROOT/Engine/Binaries/Mac/UnrealEditor-Cmd" "$UPROJECT" \
  -run=pythonscript -script="$PROJ_DIR/Tools/setup_editor.py" \
  -stdout -unattended -nopause -nosplash -nosound
PY_RC=$?
if [ $PY_RC -ne 0 ]; then
  echo "WARN: editor scripting step exited $PY_RC — open the project and check; the game still runs on pure C++ defaults."
fi

# --- 7. Point the default game mode at the BP (so BP_Vowless is the pawn) ----
INI="$PROJ_DIR/Config/DefaultEngine.ini"
if grep -q "GlobalDefaultGameMode=/Script/AshenVow.AV_GameMode" "$INI"; then
  sed -i '' 's|GlobalDefaultGameMode=/Script/AshenVow.AV_GameMode|GlobalDefaultGameMode=/Game/AshenVow/Blueprints/BP_AVGameMode.BP_AVGameMode_C|' "$INI"
  echo "DefaultEngine.ini: game mode -> BP_AVGameMode"
fi

echo ""
echo "== DONE =="
echo "Open the project:  open \"$UPROJECT\""
echo "Then press Play. Controls: WASD move, mouse look, Shift sprint, Space dodge,"
echo "LMB/RMB attack, Q lock-on, F interact, R flask."

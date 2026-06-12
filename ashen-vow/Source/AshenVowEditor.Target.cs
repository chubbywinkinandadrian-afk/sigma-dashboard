using UnrealBuildTool;
using System.Collections.Generic;

public class AshenVowEditorTarget : TargetRules
{
	public AshenVowEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("AshenVow");
	}
}

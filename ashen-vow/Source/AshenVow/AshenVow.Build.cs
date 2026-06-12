using UnrealBuildTool;

public class AshenVow : ModuleRules
{
	public AshenVow(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"AIModule",
			"NavigationSystem",
			"UMG",
			"Slate",
			"SlateCore"
		});

		// UBT adds Public/Private include roots automatically.
	}
}

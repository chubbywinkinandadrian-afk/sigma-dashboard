#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "AV_GameHUD.generated.h"

/**
 * Canvas-drawn placeholder HUD: health/stamina bars, flask + Ash counters,
 * interaction prompt, lock-on reticle, and the "YOU ARE FORGOTTEN" death overlay.
 * Requires zero UMG setup, so the prototype is fully playable from C++ alone.
 * It automatically steps aside per-element once WBP widgets are assigned on
 * AAV_PlayerController, letting UMG take over during the polish milestone.
 */
UCLASS()
class ASHENVOW_API AAV_GameHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;

protected:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|HUD")
	FLinearColor HealthColor = FLinearColor(0.45f, 0.08f, 0.08f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|HUD")
	FLinearColor StaminaColor = FLinearColor(0.25f, 0.32f, 0.18f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|HUD")
	FLinearColor BarBackColor = FLinearColor(0.02f, 0.02f, 0.02f, 0.8f);

	/** Bone-white text — pale, not pure white, to match the ash palette. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|HUD")
	FLinearColor TextColor = FLinearColor(0.85f, 0.83f, 0.78f);

private:
	void DrawBar(float X, float Y, float Width, float Height, float Percent, const FLinearColor& FillColor);
	void DrawCenteredText(const FString& Text, float CenterX, float Y, const FLinearColor& Color, UFont* Font, float Scale);
	void DrawDeathOverlay();
};

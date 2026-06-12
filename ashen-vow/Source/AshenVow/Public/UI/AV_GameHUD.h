#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "AV_GameHUD.generated.h"

class AAV_PlayerCharacter;
class AAV_PlayerController;

/**
 * Canvas-drawn placeholder HUD: health/stamina/Vow-Energy bars, flask + Ash
 * counters, equipped Vow name, interaction prompt, lock-on reticle, dialogue
 * panel (F to continue), resting Vow-selection list (keys 1-3), notification
 * toasts, and the "YOU ARE FORGOTTEN" death overlay.
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

	/** Queue a toast (Memory Threads, pickups, Vow changes). */
	void PushNotification(const FText& Message);

protected:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|HUD")
	FLinearColor HealthColor = FLinearColor(0.45f, 0.08f, 0.08f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|HUD")
	FLinearColor StaminaColor = FLinearColor(0.25f, 0.32f, 0.18f);

	/** Pale gold — the color of a promise. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|HUD")
	FLinearColor VowEnergyColor = FLinearColor(0.55f, 0.45f, 0.18f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|HUD")
	FLinearColor BarBackColor = FLinearColor(0.02f, 0.02f, 0.02f, 0.8f);

	/** Bone-white text — pale, not pure white, to match the ash palette. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|HUD")
	FLinearColor TextColor = FLinearColor(0.85f, 0.83f, 0.78f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|HUD", meta = (ClampMin = "1.0"))
	float NotificationDuration = 4.5f;

private:
	void DrawBar(float X, float Y, float Width, float Height, float Percent, const FLinearColor& FillColor);
	void DrawCenteredText(const FString& Text, float CenterX, float Y, const FLinearColor& Color, UFont* Font, float Scale);
	void DrawDeathOverlay();
	void DrawEnemyHealthBars();
	void DrawDamageFlash(float CurrentHealth);
	void DrawVowStatus(const AAV_PlayerCharacter* Player);
	void DrawDialoguePanel(const AAV_PlayerController* PC);
	void DrawRestingVowList(const AAV_PlayerCharacter* Player);
	void DrawNotifications();

	struct FAV_HudNotification
	{
		FString Text;
		double ExpireTime = 0.0;
	};
	TArray<FAV_HudNotification> Notifications;

	/** Red screen edge flash when the player takes damage. */
	float DamageFlashAlpha = 0.f;
	float LastSeenPlayerHealth = -1.f;
};

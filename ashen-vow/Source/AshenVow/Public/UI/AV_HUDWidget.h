#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "AV_HUDWidget.generated.h"

class AAV_PlayerCharacter;

/**
 * Base class for WBP_HUD. Exposes pure getters so the Blueprint widget can bind
 * progress bars and text directly: health/stamina percent, flask charges, Ash,
 * the interaction prompt, and the lock-on target's screen position.
 * Vow Energy and the Vow name slot arrive with Milestone 2.
 */
UCLASS(Abstract)
class ASHENVOW_API UAV_HUDWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	float GetHealthPercent() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	float GetStaminaPercent() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	int32 GetFlaskCharges() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	int32 GetMaxFlaskCharges() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	int32 GetAshCount() const;

	/** Empty text when nothing is in range — collapse the prompt widget then. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	FText GetInteractionPrompt() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	bool IsLockedOn() const;

	/** Viewport position of the lock-on reticle. False when not locked or off-screen. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	bool GetLockOnScreenPosition(FVector2D& OutScreenPosition) const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	float GetVowEnergyPercent() const;

	/** Equipped Vow's display name; "Vowless" when none. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	FText GetEquippedVowName() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|HUD")
	float GetVowAbilityCooldownRemaining() const;

	/** Toast for pickups, Memory Threads, and Vow changes. Implement in the WBP
	 *  (fade a single text block in/out — keep it minimal and quiet). */
	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|HUD")
	void ShowNotification(const FText& Message);

protected:
	AAV_PlayerCharacter* GetPlayer() const;
};

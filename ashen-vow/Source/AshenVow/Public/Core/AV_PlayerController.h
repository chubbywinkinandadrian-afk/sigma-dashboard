#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "AV_PlayerController.generated.h"

class UUserWidget;
class UAV_HUDWidget;

/**
 * Creates and owns the UI: the HUD and the death screen.
 * Assign WBP_HUD / WBP_DeathScreen in a Blueprint child (BP_AVPlayerController);
 * without them the game still runs, just without UI.
 */
UCLASS()
class ASHENVOW_API AAV_PlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	void ShowDeathScreen();
	void HideDeathScreen();

	UFUNCTION(BlueprintPure, Category = "AshenVow|UI")
	UAV_HUDWidget* GetHUDWidget() const { return HUDWidget; }

protected:
	virtual void BeginPlay() override;

	/** Set to WBP_HUD (child of UAV_HUDWidget). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|UI")
	TSubclassOf<UAV_HUDWidget> HUDWidgetClass;

	/** Set to WBP_DeathScreen ("YOU ARE FORGOTTEN"). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|UI")
	TSubclassOf<UUserWidget> DeathScreenClass;

private:
	UPROPERTY()
	TObjectPtr<UAV_HUDWidget> HUDWidget = nullptr;

	UPROPERTY()
	TObjectPtr<UUserWidget> DeathScreenWidget = nullptr;
};

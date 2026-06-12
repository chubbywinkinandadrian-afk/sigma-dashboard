#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Vow/AV_VowTypes.h"
#include "AV_AltarMenuWidget.generated.h"

class AAV_AshenAltar;

/**
 * Base for WBP_AshenAltarMenu: Rest / Change Vow / Leave.
 * In the WBP: a Rest button -> SelectRest, a list of unlocked Vows (from
 * GetUnlockedVows) whose buttons call SelectVow with their VowId, and a Leave
 * button -> LeaveMenu. The controller opens/closes this menu.
 */
UCLASS(Abstract)
class ASHENVOW_API UAV_AltarMenuWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	/** Rest: restore, set respawn point, respawn normal enemies. Menu stays open. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Altar")
	void SelectRest();

	/** Equip an unlocked Vow. Stats change immediately. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Altar")
	void SelectVow(FName VowId);

	UFUNCTION(BlueprintCallable, Category = "AshenVow|Altar")
	void LeaveMenu();

	UFUNCTION(BlueprintPure, Category = "AshenVow|Altar")
	TArray<FAV_VowDefinition> GetUnlockedVows() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|Altar")
	FName GetEquippedVowId() const;

	/** Refresh hooks for the WBP after Rest / Vow change. */
	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Altar", meta = (DisplayName = "On Menu Changed (BP)"))
	void OnMenuChangedBP();
};

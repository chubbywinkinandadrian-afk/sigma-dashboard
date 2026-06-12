#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "AV_Interactable.generated.h"

UINTERFACE(MinimalAPI, BlueprintType)
class UAV_Interactable : public UInterface
{
	GENERATED_BODY()
};

/** Implemented by altars, NPCs, pickups, doors — anything the player can press F on. */
class ASHENVOW_API IAV_Interactable
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "AshenVow|Interaction")
	bool CanInteract(AActor* Interactor);

	/** Prompt text shown on the HUD, e.g. "Rest at Ashen Altar". */
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "AshenVow|Interaction")
	FText GetInteractionText();

	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "AshenVow|Interaction")
	void Interact(AActor* Interactor);
};

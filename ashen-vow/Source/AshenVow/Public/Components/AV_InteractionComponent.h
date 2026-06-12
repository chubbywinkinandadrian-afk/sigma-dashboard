#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "AV_InteractionComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FAV_OnFocusedInteractableChanged, AActor*, NewFocus, const FText&, PromptText);

/**
 * Player-side interaction scanner. Each tick it finds the closest IAV_Interactable
 * in range that the player is roughly facing, exposes its prompt text for the HUD,
 * and executes it when the player presses Interact (F).
 */
UCLASS(ClassGroup = (AshenVow), meta = (BlueprintSpawnableComponent))
class ASHENVOW_API UAV_InteractionComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAV_InteractionComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	/** Interact with the currently focused interactable, if any. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Interaction")
	void TryInteract();

	UFUNCTION(BlueprintPure, Category = "AshenVow|Interaction")
	AActor* GetFocusedInteractable() const { return FocusedInteractable; }

	/** Prompt for the HUD; empty when nothing is in range. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|Interaction")
	FText GetFocusedPromptText() const { return FocusedPromptText; }

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Interaction")
	FAV_OnFocusedInteractableChanged OnFocusedInteractableChanged;

protected:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Interaction", meta = (ClampMin = "50.0"))
	float InteractRange = 220.f;

	/** Interactable must be within this half-angle of the player's facing, in degrees. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Interaction", meta = (ClampMin = "10.0", ClampMax = "180.0"))
	float FacingHalfAngle = 100.f;

private:
	void UpdateFocus();

	UPROPERTY()
	TObjectPtr<AActor> FocusedInteractable = nullptr;

	FText FocusedPromptText;
};

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Interfaces/AV_Interactable.h"
#include "AV_AshenAltar.generated.h"

class UStaticMeshComponent;
class USceneComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FAV_OnAltarRested, AActor*, Rester);

/**
 * Ashen Altar — the checkpoint/rest system.
 * Resting: restores the player's health/stamina/flasks, sets this altar as the
 * respawn point, and respawns normal enemies (never bosses — they check
 * bRespawnsOnRest). The full rest menu (Rest / Change Vow / Leave) arrives with
 * the Vow system in Milestone 2; for now interacting rests immediately.
 *
 * Visuals (broken stone, pale flame, rising ash) belong in the Blueprint child;
 * OnRested is the hook for the rest VFX/SFX/fade.
 */
UCLASS()
class ASHENVOW_API AAV_AshenAltar : public AActor, public IAV_Interactable
{
	GENERATED_BODY()

public:
	AAV_AshenAltar();

	// IAV_Interactable
	virtual bool CanInteract_Implementation(AActor* Interactor) override;
	virtual FText GetInteractionText_Implementation() override;
	virtual void Interact_Implementation(AActor* Interactor) override;

	/** Where the player stands after respawning at this altar. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|Altar")
	FTransform GetRespawnTransform() const;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Altar")
	FAV_OnAltarRested OnRested;

	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Altar", meta = (DisplayName = "On Rested (BP)"))
	void OnRestedBP(AActor* Rester);

protected:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Altar")
	TObjectPtr<UStaticMeshComponent> AltarMesh;

	/** Marker child component — drag it in the level to fine-tune the respawn spot. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Altar")
	TObjectPtr<USceneComponent> RespawnPoint;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Altar")
	FText AltarDisplayName = NSLOCTEXT("AshenVow", "AltarName", "Ashen Altar");
};

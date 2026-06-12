#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Interfaces/AV_Interactable.h"
#include "AV_ItemPickup.generated.h"

class UStaticMeshComponent;

UENUM(BlueprintType)
enum class EAV_PickupType : uint8
{
	Ash          UMETA(DisplayName = "Ash (currency)"),
	VowFragment  UMETA(DisplayName = "Vow Fragment"),
	Lore         UMETA(DisplayName = "Lore (Memory Thread)"),
	FlaskUpgrade UMETA(DisplayName = "Flask Upgrade")
};

/**
 * Configurable world pickup (F to take). One actor class, four behaviours:
 *  - Ash: grants AshAmount
 *  - VowFragment: unlocks VowIdToGrant on the player's VowComponent
 *  - Lore: adds a Memory Thread entry
 *  - FlaskUpgrade: +1 max Ashen Flask charge
 * Unique pickups register in UAV_WorldStateSubsystem and never reappear,
 * including across level reloads. Any type may also attach a Memory Thread.
 */
UCLASS()
class ASHENVOW_API AAV_ItemPickup : public AActor, public IAV_Interactable
{
	GENERATED_BODY()

public:
	AAV_ItemPickup();

	// IAV_Interactable
	virtual bool CanInteract_Implementation(AActor* Interactor) override;
	virtual FText GetInteractionText_Implementation() override;
	virtual void Interact_Implementation(AActor* Interactor) override;

	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Pickup", meta = (DisplayName = "On Picked Up (BP)"))
	void OnPickedUpBP(AActor* Collector);

protected:
	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Pickup")
	TObjectPtr<UStaticMeshComponent> PickupMesh;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Pickup")
	EAV_PickupType PickupType = EAV_PickupType::Ash;

	/** Shown in the prompt and the pickup notification. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Pickup")
	FText DisplayName = NSLOCTEXT("AshenVow", "PickupDefault", "Faded Remnant");

	/** Unique pickups need a stable id and never respawn once taken. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Pickup")
	bool bUnique = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Pickup", meta = (EditCondition = "bUnique"))
	FName UniquePickupId = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Pickup",
		meta = (EditCondition = "PickupType == EAV_PickupType::Ash", ClampMin = "0"))
	int32 AshAmount = 50;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Pickup",
		meta = (EditCondition = "PickupType == EAV_PickupType::VowFragment"))
	FName VowIdToGrant = FName("VowOfIron");

	/** Optional Memory Thread added on pickup (required for Lore type). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Pickup")
	FName MemoryThreadId = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Pickup", meta = (MultiLine = "true"))
	FText MemoryThreadText;
};

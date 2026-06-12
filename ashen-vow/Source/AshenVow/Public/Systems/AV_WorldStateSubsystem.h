#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "AV_WorldStateSubsystem.generated.h"

/**
 * Persistent world facts that must survive death, altar rests, and level
 * reloads: collected unique items, defeated bosses (Milestone 3), and generic
 * named flags (NPC met, shortcut opened, gate unlocked). The save system
 * serializes exactly this state later.
 */
UCLASS()
class ASHENVOW_API UAV_WorldStateSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	// ---- Unique items (pickups that never respawn) ----

	UFUNCTION(BlueprintCallable, Category = "AshenVow|WorldState")
	void MarkUniqueItemCollected(FName ItemId) { CollectedUniqueItems.Add(ItemId); }

	UFUNCTION(BlueprintPure, Category = "AshenVow|WorldState")
	bool IsUniqueItemCollected(FName ItemId) const { return CollectedUniqueItems.Contains(ItemId); }

	// ---- Bosses ----

	UFUNCTION(BlueprintCallable, Category = "AshenVow|WorldState")
	void MarkBossDefeated(FName BossId) { DefeatedBosses.Add(BossId); }

	UFUNCTION(BlueprintPure, Category = "AshenVow|WorldState")
	bool IsBossDefeated(FName BossId) const { return DefeatedBosses.Contains(BossId); }

	// ---- Generic flags ----

	UFUNCTION(BlueprintCallable, Category = "AshenVow|WorldState")
	void SetFlag(FName Flag) { Flags.Add(Flag); }

	UFUNCTION(BlueprintPure, Category = "AshenVow|WorldState")
	bool HasFlag(FName Flag) const { return Flags.Contains(Flag); }

	// ---- Save-system hooks ----

	TSet<FName>& GetCollectedUniqueItems() { return CollectedUniqueItems; }
	TSet<FName>& GetDefeatedBosses() { return DefeatedBosses; }
	TSet<FName>& GetFlags() { return Flags; }

private:
	UPROPERTY()
	TSet<FName> CollectedUniqueItems;

	UPROPERTY()
	TSet<FName> DefeatedBosses;

	UPROPERTY()
	TSet<FName> Flags;
};

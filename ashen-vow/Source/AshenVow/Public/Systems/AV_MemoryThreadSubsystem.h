#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "AV_MemoryThreadSubsystem.generated.h"

/** One remembered clue. Not a quest marker — a fragment of understanding. */
USTRUCT(BlueprintType)
struct FAV_MemoryThreadEntry
{
	GENERATED_BODY()

	/** Stable id for dedupe and saving (e.g. "MT_Elya_WhiteSun"). */
	UPROPERTY(BlueprintReadOnly, Category = "MemoryThread")
	FName EntryId = NAME_None;

	UPROPERTY(BlueprintReadOnly, Category = "MemoryThread")
	FText Text;

	/** Discovery order, for a stable journal sort. */
	UPROPERTY(BlueprintReadOnly, Category = "MemoryThread")
	int32 Order = 0;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FAV_OnMemoryThreadAdded, const FAV_MemoryThreadEntry&, Entry);

/**
 * Memory Threads — the soft lore journal that replaces quest tracking.
 * Short mysterious clues added by dialogue, pickups, altars, boss deaths, and
 * area triggers. Lives on the GameInstance so entries survive death, respawn,
 * and level reloads; the save system (later milestone) serializes them.
 */
UCLASS()
class ASHENVOW_API UAV_MemoryThreadSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	/** Add an entry. Returns false if that id is already remembered. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|MemoryThread")
	bool AddEntry(FName EntryId, FText Text);

	UFUNCTION(BlueprintPure, Category = "AshenVow|MemoryThread")
	bool HasEntry(FName EntryId) const;

	/** All entries in discovery order, for the journal UI. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|MemoryThread")
	TArray<FAV_MemoryThreadEntry> GetEntries() const { return Entries; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|MemoryThread")
	int32 GetEntryCount() const { return Entries.Num(); }

	/** Save-system hook: bulk restore without re-broadcasting toasts. */
	void RestoreEntries(const TArray<FAV_MemoryThreadEntry>& SavedEntries);

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|MemoryThread")
	FAV_OnMemoryThreadAdded OnMemoryThreadAdded;

private:
	UPROPERTY()
	TArray<FAV_MemoryThreadEntry> Entries;
};

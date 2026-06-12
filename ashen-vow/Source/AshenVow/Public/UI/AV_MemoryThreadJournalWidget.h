#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Systems/AV_MemoryThreadSubsystem.h"
#include "AV_MemoryThreadJournalWidget.generated.h"

/**
 * Base for WBP_MemoryThreadJournal (Tab). In the WBP: on Construct, call
 * GetMemoryThreadEntries and fill a vertical list of text rows; wire a Close
 * button (and Tab handling is already on the player) to CloseJournal.
 */
UCLASS(Abstract)
class ASHENVOW_API UAV_MemoryThreadJournalWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintPure, Category = "AshenVow|Journal")
	TArray<FAV_MemoryThreadEntry> GetMemoryThreadEntries() const;

	UFUNCTION(BlueprintCallable, Category = "AshenVow|Journal")
	void CloseJournal();
};

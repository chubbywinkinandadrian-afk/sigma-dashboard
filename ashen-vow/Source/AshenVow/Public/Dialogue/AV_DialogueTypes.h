#pragma once

#include "CoreMinimal.h"
#include "AV_DialogueTypes.generated.h"

/**
 * One spoken line. Lines may attach a Memory Thread entry that is remembered
 * the moment the line is shown (lore lands when it is heard, not on quest-complete).
 */
USTRUCT(BlueprintType)
struct FAV_DialogueLine
{
	GENERATED_BODY()

	/** Leave empty to use the NPC's name. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FText SpeakerNameOverride;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue", meta = (MultiLine = "true"))
	FText Text;

	/** Optional Memory Thread granted when this line is shown. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FName MemoryThreadId = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue", meta = (MultiLine = "true"))
	FText MemoryThreadText;
};

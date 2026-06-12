#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Interfaces/AV_Interactable.h"
#include "Dialogue/AV_DialogueTypes.h"
#include "AV_NPCBase.generated.h"

class AAV_PlayerCharacter;

/**
 * Base for friendly NPCs. Interacting (F) starts a dialogue session owned by
 * AAV_PlayerController. First-meeting lines play once (tracked via a world-state
 * flag, so it survives death and reloads); afterwards RepeatLines play.
 * Subclasses override HandleDialogueEnded for one-time rewards.
 */
UCLASS()
class ASHENVOW_API AAV_NPCBase : public ACharacter, public IAV_Interactable
{
	GENERATED_BODY()

public:
	AAV_NPCBase();

	// IAV_Interactable
	virtual bool CanInteract_Implementation(AActor* Interactor) override;
	virtual FText GetInteractionText_Implementation() override;
	virtual void Interact_Implementation(AActor* Interactor) override;

	/** Lines for the current conversation (first meeting vs. repeat). */
	UFUNCTION(BlueprintPure, Category = "AshenVow|NPC")
	TArray<FAV_DialogueLine> GetCurrentDialogueLines() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|NPC")
	FText GetNpcDisplayName() const { return NpcDisplayName; }

	/** Called by the controller when the conversation finishes. */
	virtual void HandleDialogueEnded(AAV_PlayerCharacter* Player);

	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|NPC", meta = (DisplayName = "On Dialogue Ended (BP)"))
	void OnDialogueEndedBP(AAV_PlayerCharacter* Player);

protected:
	bool HasMetPlayer() const;
	FName GetMetFlagName() const;

	/** Stable id for world-state flags ("Elya"). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|NPC")
	FName NpcId = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|NPC")
	FText NpcDisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Dialogue")
	TArray<FAV_DialogueLine> FirstMeetingLines;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Dialogue")
	TArray<FAV_DialogueLine> RepeatLines;
};

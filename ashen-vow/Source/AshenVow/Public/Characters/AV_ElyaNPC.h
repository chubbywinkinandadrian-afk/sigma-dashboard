#pragma once

#include "CoreMinimal.h"
#include "Characters/AV_NPCBase.h"
#include "AV_ElyaNPC.generated.h"

/**
 * Elya — a masked guide who finds The Vowless. Helpful but mysterious; she
 * knows more about the White Sun than she admits.
 *
 * First conversation: explains the world, points the player toward The
 * Crownless Gate, adds the White Sun Memory Thread, and grants the first Vow
 * fragment (Vow of Ash). Visuals (hooded mask, pale cloak) go in the BP child.
 */
UCLASS()
class ASHENVOW_API AAV_ElyaNPC : public AAV_NPCBase
{
	GENERATED_BODY()

public:
	AAV_ElyaNPC();

	virtual void HandleDialogueEnded(AAV_PlayerCharacter* Player) override;

protected:
	/** Vow fragment granted after the first conversation. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Elya")
	FName FirstVowGrant = FName("VowOfAsh");
};

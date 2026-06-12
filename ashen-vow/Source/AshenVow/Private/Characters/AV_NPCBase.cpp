#include "Characters/AV_NPCBase.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Core/AV_PlayerController.h"
#include "Systems/AV_WorldStateSubsystem.h"
#include "GameFramework/CharacterMovementComponent.h"

AAV_NPCBase::AAV_NPCBase()
{
	PrimaryActorTick.bCanEverTick = false;
	NpcDisplayName = NSLOCTEXT("AshenVow", "UnknownNPC", "Stranger");
}

bool AAV_NPCBase::CanInteract_Implementation(AActor* Interactor)
{
	const AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(Interactor);
	return Player && Player->IsAlive() && GetCurrentDialogueLines().Num() > 0;
}

FText AAV_NPCBase::GetInteractionText_Implementation()
{
	return FText::Format(NSLOCTEXT("AshenVow", "TalkPrompt", "Talk to {0}"), NpcDisplayName);
}

void AAV_NPCBase::Interact_Implementation(AActor* Interactor)
{
	const AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(Interactor);
	if (!Player)
	{
		return;
	}
	if (AAV_PlayerController* PC = Cast<AAV_PlayerController>(Player->GetController()))
	{
		PC->StartDialogue(this);
	}
}

TArray<FAV_DialogueLine> AAV_NPCBase::GetCurrentDialogueLines() const
{
	return HasMetPlayer() ? RepeatLines : FirstMeetingLines;
}

void AAV_NPCBase::HandleDialogueEnded(AAV_PlayerCharacter* Player)
{
	if (UGameInstance* GameInstance = GetGameInstance())
	{
		if (UAV_WorldStateSubsystem* WorldState = GameInstance->GetSubsystem<UAV_WorldStateSubsystem>())
		{
			WorldState->SetFlag(GetMetFlagName());
		}
	}
	OnDialogueEndedBP(Player);
}

bool AAV_NPCBase::HasMetPlayer() const
{
	if (const UGameInstance* GameInstance = GetGameInstance())
	{
		if (const UAV_WorldStateSubsystem* WorldState = GameInstance->GetSubsystem<UAV_WorldStateSubsystem>())
		{
			return WorldState->HasFlag(GetMetFlagName());
		}
	}
	return false;
}

FName AAV_NPCBase::GetMetFlagName() const
{
	return FName(*FString::Printf(TEXT("NPC_%s_Met"), *NpcId.ToString()));
}

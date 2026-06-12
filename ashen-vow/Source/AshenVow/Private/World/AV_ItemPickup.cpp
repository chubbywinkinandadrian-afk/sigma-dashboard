#include "World/AV_ItemPickup.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Components/AV_VowComponent.h"
#include "Core/AV_PlayerController.h"
#include "Systems/AV_MemoryThreadSubsystem.h"
#include "Systems/AV_WorldStateSubsystem.h"
#include "UI/AV_HUDWidget.h"
#include "Components/StaticMeshComponent.h"

AAV_ItemPickup::AAV_ItemPickup()
{
	PrimaryActorTick.bCanEverTick = false;

	PickupMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PickupMesh"));
	SetRootComponent(PickupMesh);
	PickupMesh->SetCollisionProfileName(TEXT("NoCollision")); // taken via the interaction scan
}

void AAV_ItemPickup::BeginPlay()
{
	Super::BeginPlay();

	// Already taken in a previous visit/session — remove silently.
	if (bUnique && UniquePickupId != NAME_None)
	{
		if (const UGameInstance* GameInstance = GetGameInstance())
		{
			const UAV_WorldStateSubsystem* WorldState = GameInstance->GetSubsystem<UAV_WorldStateSubsystem>();
			if (WorldState && WorldState->IsUniqueItemCollected(UniquePickupId))
			{
				Destroy();
			}
		}
	}
}

bool AAV_ItemPickup::CanInteract_Implementation(AActor* Interactor)
{
	const AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(Interactor);
	return Player && Player->IsAlive();
}

FText AAV_ItemPickup::GetInteractionText_Implementation()
{
	return FText::Format(NSLOCTEXT("AshenVow", "PickupPrompt", "Take {0}"), DisplayName);
}

void AAV_ItemPickup::Interact_Implementation(AActor* Interactor)
{
	AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(Interactor);
	if (!Player)
	{
		return;
	}

	UGameInstance* GameInstance = GetGameInstance();
	FText Notification = FText::Format(NSLOCTEXT("AshenVow", "PickupTaken", "{0} taken"), DisplayName);

	switch (PickupType)
	{
	case EAV_PickupType::Ash:
		Player->AddAsh(AshAmount);
		Notification = FText::Format(
			NSLOCTEXT("AshenVow", "AshTaken", "Gathered {0} Ash"), FText::AsNumber(AshAmount));
		break;

	case EAV_PickupType::VowFragment:
		if (UAV_VowComponent* VowComponent = Player->GetVowComponent())
		{
			VowComponent->GrantVow(VowIdToGrant);
			FAV_VowDefinition Definition;
			if (VowComponent->FindVowDefinition(VowIdToGrant, Definition))
			{
				Notification = FText::Format(
					NSLOCTEXT("AshenVow", "VowTaken", "Vow fragment remembered: {0}"), Definition.DisplayName);
			}
		}
		break;

	case EAV_PickupType::FlaskUpgrade:
		Player->IncreaseMaxFlaskCharges(1);
		Notification = NSLOCTEXT("AshenVow", "FlaskUpgraded", "The Ashen Flask deepens");
		break;

	case EAV_PickupType::Lore:
	default:
		break; // the Memory Thread below carries the reward
	}

	if (MemoryThreadId != NAME_None && GameInstance)
	{
		if (UAV_MemoryThreadSubsystem* Threads = GameInstance->GetSubsystem<UAV_MemoryThreadSubsystem>())
		{
			Threads->AddEntry(MemoryThreadId, MemoryThreadText);
		}
	}

	if (bUnique && UniquePickupId != NAME_None && GameInstance)
	{
		if (UAV_WorldStateSubsystem* WorldState = GameInstance->GetSubsystem<UAV_WorldStateSubsystem>())
		{
			WorldState->MarkUniqueItemCollected(UniquePickupId);
		}
	}

	if (const AAV_PlayerController* PC = Cast<AAV_PlayerController>(Player->GetController()))
	{
		if (UAV_HUDWidget* HUD = PC->GetHUDWidget())
		{
			HUD->ShowNotification(Notification);
		}
	}

	OnPickedUpBP(Player);
	Destroy();
}

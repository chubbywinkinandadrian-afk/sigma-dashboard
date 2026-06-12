#include "World/AV_AshenAltar.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Core/AV_GameMode.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/World.h"

AAV_AshenAltar::AAV_AshenAltar()
{
	PrimaryActorTick.bCanEverTick = false;

	AltarMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("AltarMesh"));
	SetRootComponent(AltarMesh);
	AltarMesh->SetCollisionProfileName(TEXT("BlockAll"));

	RespawnPoint = CreateDefaultSubobject<USceneComponent>(TEXT("RespawnPoint"));
	RespawnPoint->SetupAttachment(AltarMesh);
	RespawnPoint->SetRelativeLocation(FVector(150.f, 0.f, 0.f));
}

bool AAV_AshenAltar::CanInteract_Implementation(AActor* Interactor)
{
	const AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(Interactor);
	return Player && Player->IsAlive();
}

FText AAV_AshenAltar::GetInteractionText_Implementation()
{
	return FText::Format(
		NSLOCTEXT("AshenVow", "RestPrompt", "Rest at {0}"), AltarDisplayName);
}

void AAV_AshenAltar::Interact_Implementation(AActor* Interactor)
{
	AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(Interactor);
	if (!Player)
	{
		return;
	}

	if (AAV_GameMode* GameMode = GetWorld()->GetAuthGameMode<AAV_GameMode>())
	{
		GameMode->SetActiveAltar(this);
		GameMode->ResetWorldEnemies();
	}

	Player->RestoreAtAltar();

	OnRested.Broadcast(Player);
	OnRestedBP(Player);
}

FTransform AAV_AshenAltar::GetRespawnTransform() const
{
	FTransform Transform = RespawnPoint->GetComponentTransform();
	Transform.SetScale3D(FVector::OneVector);
	return Transform;
}

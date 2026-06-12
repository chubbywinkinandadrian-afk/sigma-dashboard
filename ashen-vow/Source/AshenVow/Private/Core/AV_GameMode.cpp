#include "Core/AV_GameMode.h"
#include "Core/AV_PlayerController.h"
#include "UI/AV_GameHUD.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Characters/AV_EnemyBase.h"
#include "World/AV_AshenAltar.h"
#include "GameFramework/PlayerStart.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
#include "TimerManager.h"

AAV_GameMode::AAV_GameMode()
{
	DefaultPawnClass = AAV_PlayerCharacter::StaticClass();
	PlayerControllerClass = AAV_PlayerController::StaticClass();
	HUDClass = AAV_GameHUD::StaticClass(); // canvas placeholder HUD; UMG replaces it later
}

void AAV_GameMode::BeginPlay()
{
	Super::BeginPlay();

	// Until the first altar is touched, death returns the player to the PlayerStart.
	for (TActorIterator<APlayerStart> It(GetWorld()); It; ++It)
	{
		FallbackSpawnTransform = (*It)->GetActorTransform();
		FallbackSpawnTransform.SetScale3D(FVector::OneVector);
		break;
	}
}

void AAV_GameMode::SetActiveAltar(AAV_AshenAltar* Altar)
{
	ActiveAltar = Altar;
}

void AAV_GameMode::HandlePlayerDeath(AAV_PlayerCharacter* Player)
{
	PendingRespawnPlayer = Player;
	OnPlayerDeathStarted.Broadcast();

	if (AAV_PlayerController* PC = Cast<AAV_PlayerController>(Player->GetController()))
	{
		PC->ShowDeathScreen();
	}

	GetWorldTimerManager().SetTimer(RespawnTimer, this, &AAV_GameMode::RespawnPlayer, RespawnDelay, false);
}

void AAV_GameMode::RespawnPlayer()
{
	if (!PendingRespawnPlayer)
	{
		return;
	}

	ResetWorldEnemies();
	PendingRespawnPlayer->ResetForRespawn(GetRespawnTransform());

	if (AAV_PlayerController* PC = Cast<AAV_PlayerController>(PendingRespawnPlayer->GetController()))
	{
		PC->HideDeathScreen();
	}

	PendingRespawnPlayer = nullptr;
	OnPlayerRespawned.Broadcast();
}

FTransform AAV_GameMode::GetRespawnTransform() const
{
	return ActiveAltar ? ActiveAltar->GetRespawnTransform() : FallbackSpawnTransform;
}

void AAV_GameMode::ResetWorldEnemies()
{
	for (TActorIterator<AAV_EnemyBase> It(GetWorld()); It; ++It)
	{
		It->ResetForRespawn();
	}
}

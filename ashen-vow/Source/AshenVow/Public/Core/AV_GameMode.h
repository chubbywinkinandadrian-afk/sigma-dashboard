#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "AV_GameMode.generated.h"

class AAV_AshenAltar;
class AAV_PlayerCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FAV_OnPlayerDeathStarted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FAV_OnPlayerRespawned);

/**
 * Owns the death -> respawn loop and world resets.
 * Death: broadcast (controller shows the death screen), wait RespawnDelay,
 * then restore the SAME pawn at the last Ashen Altar and respawn normal enemies.
 * Falls back to the PlayerStart transform before any altar has been touched.
 */
UCLASS()
class ASHENVOW_API AAV_GameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AAV_GameMode();

	UFUNCTION(BlueprintCallable, Category = "AshenVow|GameMode")
	void SetActiveAltar(AAV_AshenAltar* Altar);

	UFUNCTION(BlueprintPure, Category = "AshenVow|GameMode")
	AAV_AshenAltar* GetActiveAltar() const { return ActiveAltar; }

	/** Called by the player character when it dies. */
	void HandlePlayerDeath(AAV_PlayerCharacter* Player);

	/** Reset every AAV_EnemyBase with bRespawnsOnRest (altar rest + player respawn). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|GameMode")
	void ResetWorldEnemies();

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|GameMode")
	FAV_OnPlayerDeathStarted OnPlayerDeathStarted;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|GameMode")
	FAV_OnPlayerRespawned OnPlayerRespawned;

protected:
	virtual void BeginPlay() override;

	/** Seconds the death screen stays up before respawning. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|GameMode", meta = (ClampMin = "0.5"))
	float RespawnDelay = 4.f;

private:
	void RespawnPlayer();
	FTransform GetRespawnTransform() const;

	UPROPERTY()
	TObjectPtr<AAV_AshenAltar> ActiveAltar = nullptr;

	UPROPERTY()
	TObjectPtr<AAV_PlayerCharacter> PendingRespawnPlayer = nullptr;

	FTransform FallbackSpawnTransform = FTransform::Identity;
	FTimerHandle RespawnTimer;
};

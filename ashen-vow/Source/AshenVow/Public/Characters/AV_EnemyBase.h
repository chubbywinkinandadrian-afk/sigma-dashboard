#pragma once

#include "CoreMinimal.h"
#include "Characters/AV_CharacterBase.h"
#include "Interfaces/AV_Targetable.h"
#include "AV_EnemyBase.generated.h"

UENUM(BlueprintType)
enum class EAV_EnemyState : uint8
{
	Idle      UMETA(DisplayName = "Idle"),
	Patrol    UMETA(DisplayName = "Patrol"),
	Chase     UMETA(DisplayName = "Chase"),
	Combat    UMETA(DisplayName = "Combat"),
	Returning UMETA(DisplayName = "Returning"),
	Dead      UMETA(DisplayName = "Dead")
};

/**
 * Reusable enemy with a readable state machine:
 * Idle/Patrol -> Chase (player detected) -> Combat (in attack range) -> attack with
 * windup/active/recovery via the shared melee component -> cooldown -> repeat.
 * Leashes back home if the player escapes. Staggers on poise break (punish window).
 *
 * Death deactivates the enemy instead of destroying it so Ashen Altar rest can
 * respawn it (ResetForRespawn). Bosses will set bRespawnsOnRest = false.
 *
 * Navigation uses the AIController/navmesh when available and falls back to direct
 * movement, so the prototype works even before a NavMeshBoundsVolume is placed.
 */
UCLASS()
class ASHENVOW_API AAV_EnemyBase : public AAV_CharacterBase, public IAV_Targetable
{
	GENERATED_BODY()

public:
	AAV_EnemyBase();

	virtual void Tick(float DeltaTime) override;

	// IAV_Targetable
	virtual bool IsTargetable_Implementation() override;
	virtual FVector GetTargetPoint_Implementation() override;

	/** Restore to spawn state (altar rest / player respawn). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Enemy")
	virtual void ResetForRespawn();

	UFUNCTION(BlueprintPure, Category = "AshenVow|Enemy")
	EAV_EnemyState GetEnemyState() const { return EnemyState; }

	/** False on bosses — defeated bosses stay dead. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Enemy")
	bool bRespawnsOnRest = true;

protected:
	virtual void BeginPlay() override;
	virtual void HandleDeath(AActor* Victim, AActor* Killer) override;
	virtual void HandleDamaged(float DamageAmount, const FAV_DamageInfo& DamageInfo) override;
	virtual void EnterStagger(float Duration) override;

	void SetEnemyState(EAV_EnemyState NewState);

	/** Pick the next attack to perform. Subclasses/bosses override for phase logic. */
	virtual const FAV_AttackData* ChooseNextAttack();

	UFUNCTION()
	void HandleAttackSequenceFinished();

	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Enemy", meta = (DisplayName = "On Enemy State Changed (BP)"))
	void OnEnemyStateChangedBP(EAV_EnemyState NewState);

	// ---- Perception ----
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Perception", meta = (ClampMin = "100.0"))
	float DetectRadius = 900.f;

	/** Gives up the chase beyond this distance from home. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Perception", meta = (ClampMin = "100.0"))
	float LeashRadius = 2200.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Perception")
	bool bRequireLineOfSightToDetect = true;

	// ---- Movement ----
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Movement", meta = (ClampMin = "10.0"))
	float PatrolSpeed = 140.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Movement", meta = (ClampMin = "10.0"))
	float ChaseSpeed = 420.f;

	/** Patrol waypoints in world space (set per-instance in the level). Empty = stand idle. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Movement", meta = (MakeEditWidget = "true"))
	TArray<FVector> PatrolPoints;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Movement", meta = (ClampMin = "0.0"))
	float PatrolWaitTime = 2.5f;

	// ---- Combat ----
	/** Attack sequence: each entry chains after the previous within the combo window. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Combat")
	TArray<FAV_AttackData> AttackCombo;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Combat", meta = (ClampMin = "50.0"))
	float AttackRange = 180.f;

	/** Seconds of vulnerability between attack sequences (the player's punish window). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Combat", meta = (ClampMin = "0.0"))
	float AttackCooldownMin = 1.2f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Combat", meta = (ClampMin = "0.0"))
	float AttackCooldownMax = 2.4f;

	/** Chance (0..1) to continue the combo after each attack instead of stopping at one swing. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Combat", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float ComboContinueChance = 0.65f;

	// ---- Reward ----
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Reward", meta = (ClampMin = "0"))
	int32 AshReward = 35;

	/** Seconds after death before the body is hidden (BP can play a dissolve first). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Enemy", meta = (ClampMin = "0.0"))
	float CorpseLingerTime = 4.f;

private:
	void TickIdle();
	void TickPatrol();
	void TickChase(float DeltaTime);
	void TickCombat(float DeltaTime);
	void TickReturning();

	APawn* FindPlayerIfDetectable() const;
	bool CanSee(const AActor* Target) const;
	void MoveTowards(const FVector& Destination, float AcceptanceRadius);
	void FaceTowards(const FVector& Point, float DeltaTime, float Speed = 6.f);
	void StopMoving();
	void DeactivateCorpse();

	EAV_EnemyState EnemyState = EAV_EnemyState::Idle;

	UPROPERTY()
	TObjectPtr<APawn> TargetPlayer = nullptr;

	FTransform HomeTransform;
	int32 CurrentPatrolIndex = 0;
	float PatrolWaitElapsed = 0.f;
	float AttackCooldownRemaining = 0.f;
	int32 ComboAttackIndex = 0;
	bool bAttackInProgress = false;
	float RepathElapsed = 0.f;
	bool bDirectMoveFallback = false;
	FTimerHandle CorpseTimer;
};

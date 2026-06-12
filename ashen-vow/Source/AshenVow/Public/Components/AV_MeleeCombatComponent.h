#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/AV_Types.h"
#include "AV_MeleeCombatComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FAV_OnAttackPhaseChanged, EAV_AttackPhase, NewPhase);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FAV_OnAttackHitLanded, AActor*, HitActor);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FAV_OnAttackFinished);

/**
 * Executes one melee attack at a time with strict startup -> active -> recovery phases.
 * Damage is applied ONLY during the active window via a swept sphere in front of the owner.
 * Shared by the player, enemies, and (later) bosses. The owner decides combos/buffering;
 * this component only runs and reports a single attack.
 *
 * Targets are filtered by actor tag (player hits "Enemy", enemies hit "Player") so the
 * two sides can never friendly-fire themselves with the same code path.
 */
UCLASS(ClassGroup = (AshenVow), meta = (BlueprintSpawnableComponent))
class ASHENVOW_API UAV_MeleeCombatComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAV_MeleeCombatComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	/** Start an attack. Fails (returns false) if another attack is in progress. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Combat")
	bool BeginAttack(const FAV_AttackData& AttackData);

	/** Hard-cancel the current attack (stagger/death interrupts). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Combat")
	void AbortAttack();

	UFUNCTION(BlueprintPure, Category = "AshenVow|Combat")
	bool IsAttacking() const { return CurrentPhase != EAV_AttackPhase::None; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Combat")
	EAV_AttackPhase GetAttackPhase() const { return CurrentPhase; }

	/** True once enough of recovery has elapsed that a combo follow-up may cancel the rest. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|Combat")
	bool CanComboCancel() const;

	/** Tag a victim must carry to be damaged by this component ("Enemy" or "Player"). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Combat")
	FName TargetTag = FName("Enemy");

	/** Fraction of recovery that must elapse before a combo can cancel it (0..1). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Combat", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float ComboCancelFraction = 0.45f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|Combat|Debug")
	bool bDrawDebugHits = false;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Combat")
	FAV_OnAttackPhaseChanged OnAttackPhaseChanged;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Combat")
	FAV_OnAttackHitLanded OnAttackHitLanded;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Combat")
	FAV_OnAttackFinished OnAttackFinished;

private:
	void EnterPhase(EAV_AttackPhase NewPhase);
	void AdvancePhase();
	void PerformHitSweep();

	FAV_AttackData ActiveAttack;
	EAV_AttackPhase CurrentPhase = EAV_AttackPhase::None;
	float PhaseTimeElapsed = 0.f;

	/** Actors already hit by the current swing (one hit per swing per victim). */
	UPROPERTY()
	TSet<TObjectPtr<AActor>> HitActorsThisSwing;
};

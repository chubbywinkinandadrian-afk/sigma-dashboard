#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Core/AV_Types.h"
#include "AV_CharacterBase.generated.h"

class UAV_HealthComponent;
class UAV_StaminaComponent;
class UAV_MeleeCombatComponent;

/**
 * Shared base for the player, enemies, and bosses.
 * Wires health/stamina/melee components together and owns the action state machine:
 * poise break -> stagger (interrupts attacks), death -> ragdoll-free collapse + events.
 * Placeholder-animation hooks are exposed as BlueprintImplementableEvents (OnXxxBP).
 */
UCLASS(Abstract)
class ASHENVOW_API AAV_CharacterBase : public ACharacter
{
	GENERATED_BODY()

public:
	AAV_CharacterBase();

	UFUNCTION(BlueprintPure, Category = "AshenVow|Character")
	bool IsAlive() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|Character")
	EAV_ActionState GetActionState() const { return ActionState; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Character")
	UAV_HealthComponent* GetHealthComponent() const { return HealthComponent; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Character")
	UAV_StaminaComponent* GetStaminaComponent() const { return StaminaComponent; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Character")
	UAV_MeleeCombatComponent* GetMeleeCombatComponent() const { return MeleeCombatComponent; }

protected:
	virtual void BeginPlay() override;

	/** State transitions go through here so subclasses can veto/extend. */
	virtual void SetActionState(EAV_ActionState NewState);

	UFUNCTION()
	virtual void HandleDamaged(float DamageAmount, const FAV_DamageInfo& DamageInfo);

	UFUNCTION()
	virtual void HandlePoiseBroken();

	UFUNCTION()
	virtual void HandleDeath(AActor* Victim, AActor* Killer);

	virtual void EnterStagger(float Duration);
	virtual void ExitStagger();

	/** Placeholder animation/SFX hooks — implement in Blueprint with montages or effects. */
	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Character", meta = (DisplayName = "On Damaged (BP)"))
	void OnDamagedBP(float DamageAmount, const FAV_DamageInfo& DamageInfo);

	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Character", meta = (DisplayName = "On Staggered (BP)"))
	void OnStaggeredBP(float Duration);

	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Character", meta = (DisplayName = "On Death (BP)"))
	void OnDeathBP(AActor* Killer);

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Components")
	TObjectPtr<UAV_HealthComponent> HealthComponent;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Components")
	TObjectPtr<UAV_StaminaComponent> StaminaComponent;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Components")
	TObjectPtr<UAV_MeleeCombatComponent> MeleeCombatComponent;

	/** Seconds this character stays staggered after a poise break. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Combat", meta = (ClampMin = "0.1"))
	float StaggerDuration = 0.7f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Character")
	EAV_ActionState ActionState = EAV_ActionState::Idle;

private:
	FTimerHandle StaggerTimer;
};

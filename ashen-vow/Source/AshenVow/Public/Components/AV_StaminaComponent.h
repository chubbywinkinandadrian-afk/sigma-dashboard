#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "AV_StaminaComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FAV_OnStaminaChanged, float, CurrentStamina, float, MaxStamina);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FAV_OnStaminaDepleted);

/**
 * Stamina pool with delayed regeneration.
 * Souls rule: an action is allowed while stamina > 0 even if the cost exceeds the
 * remaining pool (the pool clamps at 0). Disable bAllowActionWithAnyStamina for strict costs.
 * RegenMultiplier exists so Vows (Milestone 2) can slow/boost regen externally.
 */
UCLASS(ClassGroup = (AshenVow), meta = (BlueprintSpawnableComponent))
class ASHENVOW_API UAV_StaminaComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAV_StaminaComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	/** True if an action with this cost may start right now. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|Stamina")
	bool CanAfford(float Cost) const;

	/** Consume stamina for a discrete action (attack/dodge). Returns false if not affordable. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Stamina")
	bool Consume(float Cost);

	/** Continuous drain (sprint). Call every tick while draining; resets the regen delay. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Stamina")
	void Drain(float Amount);

	UFUNCTION(BlueprintCallable, Category = "AshenVow|Stamina")
	void RestoreFull();

	UFUNCTION(BlueprintPure, Category = "AshenVow|Stamina")
	float GetCurrentStamina() const { return CurrentStamina; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Stamina")
	float GetMaxStamina() const { return MaxStamina; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Stamina")
	float GetStaminaPercent() const { return MaxStamina > 0.f ? CurrentStamina / MaxStamina : 0.f; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Stamina")
	bool IsExhausted() const { return CurrentStamina <= 0.f; }

	/** Vow hook: 1.0 = normal regen. Vow of Iron will lower this in Milestone 2. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Stamina")
	void SetRegenMultiplier(float NewMultiplier) { RegenMultiplier = FMath::Max(0.f, NewMultiplier); }

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Stamina")
	FAV_OnStaminaChanged OnStaminaChanged;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Stamina")
	FAV_OnStaminaDepleted OnStaminaDepleted;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Stamina", meta = (ClampMin = "1.0"))
	float MaxStamina = 100.f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Stamina")
	float CurrentStamina = 100.f;

	/** Stamina restored per second once regen kicks in. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Stamina", meta = (ClampMin = "0.0"))
	float RegenRate = 32.f;

	/** Seconds after the last spend before regen starts. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Stamina", meta = (ClampMin = "0.0"))
	float RegenDelay = 0.9f;

	/** Souls-style leniency: act while any stamina remains. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Stamina")
	bool bAllowActionWithAnyStamina = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Stamina", meta = (ClampMin = "0.0"))
	float RegenMultiplier = 1.f;

private:
	void SpendInternal(float Amount);

	float TimeSinceLastSpend = 0.f;
};

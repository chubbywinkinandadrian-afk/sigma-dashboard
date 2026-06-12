#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Vow/AV_VowTypes.h"
#include "AV_VowComponent.generated.h"

class UAV_VowDataAsset;
class UAV_HealthComponent;
class UAV_StaminaComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FAV_OnVowEquipped, const FAV_VowDefinition&, Vow);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FAV_OnVowUnequipped);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FAV_OnVowUnlocked, const FAV_VowDefinition&, Vow);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FAV_OnVowEnergyChanged, float, CurrentEnergy, float, MaxEnergy);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FAV_OnVowAbilityActivated, const FAV_VowDefinition&, Vow);

/**
 * The Vow system — Ashen Vow's identity mechanic.
 *
 * Holds the catalog of known Vows (three built-in: Ash, Iron, Silence, plus any
 * UAV_VowDataAsset entries), tracks which fragments the player has unlocked, and
 * applies the equipped Vow's stat changes to the health/stamina components in
 * real time. Also owns Vow Energy (third resource): slow passive regen plus
 * gain on landed hits, spent by the equipped Vow's ability (E key).
 *
 * Equipping is meant to happen at Ashen Altars (the altar menu calls EquipVow);
 * GrantVow auto-equips the first fragment so the player is never Vow-locked
 * before reaching an altar.
 */
UCLASS(ClassGroup = (AshenVow), meta = (BlueprintSpawnableComponent))
class ASHENVOW_API UAV_VowComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAV_VowComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// ---- Unlock / equip ----

	/** Unlock a Vow fragment. Auto-equips if nothing is equipped yet. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Vow")
	bool GrantVow(FName VowId);

	/** Equip an unlocked Vow (altar menu). Reapplies stat modifiers immediately. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Vow")
	bool EquipVow(FName VowId);

	UFUNCTION(BlueprintCallable, Category = "AshenVow|Vow")
	void UnequipVow();

	UFUNCTION(BlueprintPure, Category = "AshenVow|Vow")
	bool IsVowUnlocked(FName VowId) const { return UnlockedVowIds.Contains(VowId); }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Vow")
	bool HasVowEquipped() const { return EquippedVow.IsValid(); }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Vow")
	const FAV_VowDefinition& GetEquippedVow() const { return EquippedVow; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Vow")
	FText GetEquippedVowDisplayName() const;

	/** All unlocked Vows, for the altar menu. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|Vow")
	TArray<FAV_VowDefinition> GetUnlockedVowDefinitions() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|Vow")
	bool FindVowDefinition(FName VowId, FAV_VowDefinition& OutDefinition) const;

	// ---- Live stat queries (combat reads these every hit) ----

	/** Includes the low-health bonus, evaluated against current HP. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|Vow")
	float GetOutgoingDamageMultiplier() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|Vow")
	float GetDodgeStaminaCostMultiplier() const;

	// ---- Vow Energy ----

	UFUNCTION(BlueprintCallable, Category = "AshenVow|VowEnergy")
	void GainEnergy(float Amount);

	/** Called when the owner lands a melee hit (combat builds Vow Energy). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|VowEnergy")
	void GainEnergyFromHit() { GainEnergy(EnergyPerHitLanded); }

	UFUNCTION(BlueprintCallable, Category = "AshenVow|VowEnergy")
	void RestoreFullEnergy();

	UFUNCTION(BlueprintPure, Category = "AshenVow|VowEnergy")
	float GetEnergyPercent() const { return MaxVowEnergy > 0.f ? CurrentVowEnergy / MaxVowEnergy : 0.f; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|VowEnergy")
	float GetCurrentEnergy() const { return CurrentVowEnergy; }

	// ---- Ability ----

	/** E key. Returns true if the ability fired (energy + cooldown checks passed). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Vow")
	bool TryActivateAbility();

	UFUNCTION(BlueprintPure, Category = "AshenVow|Vow")
	float GetAbilityCooldownRemaining() const;

	// ---- Events ----

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Vow")
	FAV_OnVowEquipped OnVowEquipped;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Vow")
	FAV_OnVowUnequipped OnVowUnequipped;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Vow")
	FAV_OnVowUnlocked OnVowUnlocked;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Vow")
	FAV_OnVowEnergyChanged OnVowEnergyChanged;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Vow")
	FAV_OnVowAbilityActivated OnVowAbilityActivated;

protected:
	virtual void BeginPlay() override;

	/** Core Vows defined in code; editable per-instance like any UPROPERTY. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Vow")
	TArray<FAV_VowDefinition> BuiltInVows;

	/** Additional designer-authored Vows (DA_Vow_* assets). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Vow")
	TArray<TObjectPtr<UAV_VowDataAsset>> ExtraVowAssets;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|VowEnergy", meta = (ClampMin = "1.0"))
	float MaxVowEnergy = 100.f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|VowEnergy")
	float CurrentVowEnergy = 0.f;

	/** Passive regen per second (scaled by the equipped Vow's VowEnergyRegenMultiplier). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|VowEnergy", meta = (ClampMin = "0.0"))
	float EnergyRegenPerSecond = 3.f;

	/** Energy gained per landed melee hit. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|VowEnergy", meta = (ClampMin = "0.0"))
	float EnergyPerHitLanded = 8.f;

	/** Tag the ability burst damages ("Enemy" on the player). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Vow")
	FName AbilityTargetTag = FName("Enemy");

private:
	void ApplyEquippedVowEffects();
	void RemoveEquippedVowEffects();
	void PerformAbilityBurst(const FAV_VowDefinition& Vow);

	UPROPERTY(VisibleAnywhere, Category = "AshenVow|Vow")
	FAV_VowDefinition EquippedVow;

	UPROPERTY(VisibleAnywhere, Category = "AshenVow|Vow")
	TArray<FName> UnlockedVowIds;

	UPROPERTY()
	TObjectPtr<UAV_HealthComponent> OwnerHealth;

	UPROPERTY()
	TObjectPtr<UAV_StaminaComponent> OwnerStamina;

	float LastAbilityTime = -1000.f;
};

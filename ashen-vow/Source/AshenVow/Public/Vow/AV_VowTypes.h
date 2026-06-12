#pragma once

#include "CoreMinimal.h"
#include "AV_VowTypes.generated.h"

/**
 * A Vow: a supernatural promise that grants power at a cost.
 * Pure data — designers tune every number. Multipliers default to 1 (no effect),
 * so a Vow only "pays for" what it changes. The three built-in Vows live in
 * UAV_VowComponent's constructor; new Vows can be added as UAV_VowDataAsset
 * assets without touching code.
 */
USTRUCT(BlueprintType)
struct FAV_VowDefinition
{
	GENERATED_BODY()

	/** Stable identifier used for equipping, unlocking, and saving. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vow")
	FName VowId = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vow")
	FText DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vow", meta = (MultiLine = "true"))
	FText Description;

	// ---- Effects (the power) ----

	/** Flat multiplier on all outgoing damage. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Effect", meta = (ClampMin = "0.0"))
	float OutgoingDamageMultiplier = 1.f;

	/** Extra outgoing damage (additive, e.g. 0.25 = +25%) while below LowHealthThreshold. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Effect", meta = (ClampMin = "0.0"))
	float LowHealthDamageBonus = 0.f;

	/** Health fraction under which LowHealthDamageBonus applies. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Effect", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float LowHealthThreshold = 0.35f;

	/** Multiplier on incoming damage (0.8 = 20% defense increase). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Effect", meta = (ClampMin = "0.0"))
	float IncomingDamageMultiplier = 1.f;

	/** Added to max poise (harder to stagger). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Effect", meta = (ClampMin = "0.0"))
	float BonusMaxPoise = 0.f;

	/** Multiplier on dodge stamina cost (0.65 = cheaper dodges). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Effect", meta = (ClampMin = "0.0"))
	float DodgeStaminaCostMultiplier = 1.f;

	/** Future critical/backstab damage multiplier (stored now, used when crits land in a later milestone). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Effect", meta = (ClampMin = "0.0"))
	float CriticalDamageMultiplier = 1.f;

	// ---- Costs (the chain) ----

	/** Multiplier on healing received (0.75 = healing reduced by 25%). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cost", meta = (ClampMin = "0.0"))
	float HealingMultiplier = 1.f;

	/** Multiplier on stamina regeneration (0.7 = slower regen). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cost", meta = (ClampMin = "0.0"))
	float StaminaRegenMultiplier = 1.f;

	/** Multiplier on Vow Energy regeneration. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cost", meta = (ClampMin = "0.0"))
	float VowEnergyRegenMultiplier = 1.f;

	// ---- Active ability (E key) ----

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ability")
	bool bHasAbility = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ability")
	FText AbilityName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ability", meta = (ClampMin = "0.0"))
	float AbilityEnergyCost = 40.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ability", meta = (ClampMin = "0.0"))
	float AbilityCooldown = 8.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ability", meta = (ClampMin = "0.0"))
	float AbilityDamage = 30.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ability", meta = (ClampMin = "0.0"))
	float AbilityPoiseDamage = 40.f;

	/** Radius of the radial burst around the player. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Ability", meta = (ClampMin = "50.0"))
	float AbilityRadius = 350.f;

	bool IsValid() const { return VowId != NAME_None; }
};

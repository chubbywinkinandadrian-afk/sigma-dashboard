#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/AV_Types.h"
#include "AV_HealthComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FAV_OnHealthChanged, float, CurrentHealth, float, MaxHealth);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FAV_OnDamaged, float, DamageAmount, const FAV_DamageInfo&, DamageInfo);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FAV_OnDeath, AActor*, Victim, AActor*, Killer);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FAV_OnPoiseBroken);

/**
 * Reusable health + poise component for player, enemies, and bosses.
 * Damage respects the invulnerability flag (dodge i-frames set it).
 * HealingMultiplier exists so Vows (Milestone 2) can modify healing without touching this class.
 */
UCLASS(ClassGroup = (AshenVow), meta = (BlueprintSpawnableComponent))
class ASHENVOW_API UAV_HealthComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAV_HealthComponent();

	/** Apply damage. Returns actual damage dealt (0 if invulnerable/dead). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Health")
	float ApplyDamage(const FAV_DamageInfo& DamageInfo);

	/** Heal, scaled by HealingMultiplier. Returns actual amount healed. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Health")
	float Heal(float Amount);

	/** Restore health and poise to max (altar rest / respawn). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Health")
	void ResetVitals();

	/** Configure pools (constructor/spawn-time stat setup for enemy subclasses). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Health")
	void InitVitals(float InMaxHealth, float InMaxPoise);

	/** i-frames: while true, ApplyDamage does nothing. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Health")
	void SetInvulnerable(bool bNewInvulnerable) { bInvulnerable = bNewInvulnerable; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Health")
	bool IsInvulnerable() const { return bInvulnerable; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Health")
	bool IsAlive() const { return CurrentHealth > 0.f; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Health")
	float GetCurrentHealth() const { return CurrentHealth; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Health")
	float GetMaxHealth() const { return MaxHealth; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Health")
	float GetHealthPercent() const { return MaxHealth > 0.f ? CurrentHealth / MaxHealth : 0.f; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Health")
	float GetHealthNormalizedLow() const { return GetHealthPercent(); }

	/** Vow hook: 1.0 = normal healing (Vow of Ash sets 0.75). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Health")
	void SetHealingMultiplier(float NewMultiplier) { HealingMultiplier = FMath::Max(0.f, NewMultiplier); }

	/** Vow hook: scales incoming damage (Vow of Iron sets 0.8 = 20% defense). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Health")
	void SetIncomingDamageMultiplier(float NewMultiplier) { IncomingDamageMultiplier = FMath::Max(0.f, NewMultiplier); }

	/** Vow hook: adds to max poise on top of the base value (Vow of Iron). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Health")
	void SetMaxPoiseBonus(float Bonus);

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Health")
	FAV_OnHealthChanged OnHealthChanged;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Health")
	FAV_OnDamaged OnDamaged;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Health")
	FAV_OnDeath OnDeath;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Health")
	FAV_OnPoiseBroken OnPoiseBroken;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Health", meta = (ClampMin = "1.0"))
	float MaxHealth = 100.f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Health")
	float CurrentHealth = 100.f;

	/** Poise pool. Damage to poise accumulates; reaching 0 staggers. <= 0 max disables poise. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Poise")
	float MaxPoise = 40.f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Poise")
	float CurrentPoise = 40.f;

	/** Seconds without poise damage before poise refills to max. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Poise", meta = (ClampMin = "0.1"))
	float PoiseResetDelay = 4.f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Health")
	bool bInvulnerable = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Health", meta = (ClampMin = "0.0"))
	float HealingMultiplier = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Health", meta = (ClampMin = "0.0"))
	float IncomingDamageMultiplier = 1.f;

private:
	void HandlePoiseDamage(float PoiseDamage);
	void ResetPoise();

	/** MaxPoise as authored, before any Vow bonus. Captured lazily on first use. */
	float BaseMaxPoise = -1.f;

	FTimerHandle PoiseResetTimer;
};

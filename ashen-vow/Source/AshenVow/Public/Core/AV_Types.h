#pragma once

#include "CoreMinimal.h"
#include "AV_Types.generated.h"

class UAnimMontage;

/** High-level action state shared by player and enemies. */
UENUM(BlueprintType)
enum class EAV_ActionState : uint8
{
	Idle        UMETA(DisplayName = "Idle"),
	Attacking   UMETA(DisplayName = "Attacking"),
	Dodging     UMETA(DisplayName = "Dodging"),
	UsingItem   UMETA(DisplayName = "Using Item"),
	Staggered   UMETA(DisplayName = "Staggered"),
	Interacting UMETA(DisplayName = "Interacting"),
	Dead        UMETA(DisplayName = "Dead")
};

/** Phase of a single melee attack. Damage is ONLY applied during Active. */
UENUM(BlueprintType)
enum class EAV_AttackPhase : uint8
{
	None     UMETA(DisplayName = "None"),
	Startup  UMETA(DisplayName = "Startup"),
	Active   UMETA(DisplayName = "Active"),
	Recovery UMETA(DisplayName = "Recovery")
};

/**
 * One configurable melee attack. Designers tune these per-attack in the editor.
 * Timing is timer-driven so the prototype works with placeholder animations;
 * later, anim-notify windows can replace the timers without changing callers.
 */
USTRUCT(BlueprintType)
struct FAV_AttackData
{
	GENERATED_BODY()

	/** Identifier for logging / anim selection. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Attack")
	FName AttackName = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Attack", meta = (ClampMin = "0.0"))
	float Damage = 15.f;

	/** Poise damage dealt on hit. Breaking poise staggers the victim. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Attack", meta = (ClampMin = "0.0"))
	float PoiseDamage = 20.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Attack", meta = (ClampMin = "0.0"))
	float StaminaCost = 12.f;

	/** Seconds before the hit window opens (windup / readability). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Timing", meta = (ClampMin = "0.01"))
	float StartupTime = 0.35f;

	/** Seconds the hit window stays open. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Timing", meta = (ClampMin = "0.01"))
	float ActiveTime = 0.20f;

	/** Seconds of recovery after the hit window (the punish window on enemies). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Timing", meta = (ClampMin = "0.0"))
	float RecoveryTime = 0.45f;

	/** Distance in front of the attacker where the hit sphere is centered. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hit Detection", meta = (ClampMin = "10.0"))
	float Range = 130.f;

	/** Radius of the hit sphere swept during the active window. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hit Detection", meta = (ClampMin = "5.0"))
	float Radius = 55.f;

	/** Forward impulse applied when the active window opens (attack commitment / lunge). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement", meta = (ClampMin = "0.0"))
	float LungeImpulse = 250.f;

	/** Optional montage. Timing above still drives gameplay until anim notifies replace it. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation")
	TObjectPtr<UAnimMontage> Montage = nullptr;
};

/** Payload for a single instance of damage. */
USTRUCT(BlueprintType)
struct FAV_DamageInfo
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Damage")
	float Amount = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Damage")
	float PoiseDamage = 0.f;

	/** Actor that caused the damage (used for Ash rewards and aggro). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Damage")
	TObjectPtr<AActor> InstigatorActor = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Damage")
	FVector HitLocation = FVector::ZeroVector;
};

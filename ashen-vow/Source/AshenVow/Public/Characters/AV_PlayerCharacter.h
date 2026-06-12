#pragma once

#include "CoreMinimal.h"
#include "Characters/AV_CharacterBase.h"
#include "AV_PlayerCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UAV_LockOnComponent;
class UAV_InteractionComponent;
class UInputMappingContext;
class UInputAction;
struct FInputActionValue;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FAV_OnFlasksChanged, int32, CurrentCharges, int32, MaxCharges);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FAV_OnAshChanged, int32, NewAshCount);

/**
 * The Vowless — the player character.
 * Movement, sprint, stamina-gated dodge with i-frames, light combo + heavy attack
 * with input buffering, Ashen Flask healing, lock-on strafing, and interaction.
 *
 * Input actions can be assigned as assets in a Blueprint child; any left unassigned
 * are created at runtime with the default PC bindings so the C++ class is playable
 * with zero editor input setup.
 */
UCLASS()
class ASHENVOW_API AAV_PlayerCharacter : public AAV_CharacterBase
{
	GENERATED_BODY()

public:
	AAV_PlayerCharacter();

	virtual void Tick(float DeltaTime) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	/** Full restore + teleport, used by altar rest and death respawn. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Player")
	void ResetForRespawn(const FTransform& RespawnTransform);

	/** Restore vitals and flasks without moving (altar rest). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Player")
	void RestoreAtAltar();

	/** Kneel at the altar and stay seated until ExitRest (press F again to rise). */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Player")
	void PlayRestSequence(const FVector& AltarLocation);

	/** Stand back up from the altar rest. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Player")
	void ExitRest();

	/** True while seated at an altar — enemies will not detect a resting player. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|Player")
	bool IsResting() const { return bResting; }

	UFUNCTION(BlueprintCallable, Category = "AshenVow|Player")
	void AddAsh(int32 Amount);

	UFUNCTION(BlueprintPure, Category = "AshenVow|Player")
	int32 GetAshCount() const { return AshCount; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Player")
	int32 GetFlaskCharges() const { return FlaskCharges; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Player")
	int32 GetMaxFlaskCharges() const { return MaxFlaskCharges; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Player")
	UAV_LockOnComponent* GetLockOnComponent() const { return LockOnComponent; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|Player")
	UAV_InteractionComponent* GetInteractionComponent() const { return InteractionComponent; }

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Player")
	FAV_OnFlasksChanged OnFlasksChanged;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|Player")
	FAV_OnAshChanged OnAshChanged;

	/** Placeholder anim/SFX hooks. */
	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Player", meta = (DisplayName = "On Dodge (BP)"))
	void OnDodgeBP(FVector InDodgeDirection);

	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Player", meta = (DisplayName = "On Flask Used (BP)"))
	void OnFlaskUsedBP();

	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Player", meta = (DisplayName = "On Attack Started (BP)"))
	void OnAttackStartedBP(const FAV_AttackData& Attack);

protected:
	virtual void BeginPlay() override;
	virtual void HandleDeath(AActor* Victim, AActor* Killer) override;

	// ---- Input handlers ----
	void Input_Move(const FInputActionValue& Value);
	void Input_Look(const FInputActionValue& Value);
	void Input_SprintStart(const FInputActionValue& Value);
	void Input_SprintStop(const FInputActionValue& Value);
	void Input_Dodge(const FInputActionValue& Value);
	void Input_Jump(const FInputActionValue& Value);
	void Input_LightAttack(const FInputActionValue& Value);
	void Input_HeavyAttack(const FInputActionValue& Value);
	void Input_Interact(const FInputActionValue& Value);
	void Input_UseFlask(const FInputActionValue& Value);
	void Input_ToggleLockOn(const FInputActionValue& Value);

	UFUNCTION()
	void HandleTargetLocked(AActor* NewTarget);

	UFUNCTION()
	void HandleTargetReleased();

	UFUNCTION()
	void HandleAttackFinished();

	// ---- Camera ----
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Camera")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Camera")
	TObjectPtr<UCameraComponent> FollowCamera;

	// ---- Components ----
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Components")
	TObjectPtr<UAV_LockOnComponent> LockOnComponent;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AshenVow|Components")
	TObjectPtr<UAV_InteractionComponent> InteractionComponent;

	// ---- Input assets (assign in BP child, or leave null for runtime defaults) ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputAction> MoveAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputAction> LookAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputAction> JumpAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputAction> SprintAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputAction> DodgeAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputAction> LightAttackAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputAction> HeavyAttackAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputAction> InteractAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputAction> UseFlaskAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Input")
	TObjectPtr<UInputAction> LockOnAction;

	// ---- Movement tuning ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Movement", meta = (ClampMin = "50.0"))
	float RunSpeed = 460.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Movement", meta = (ClampMin = "50.0"))
	float SprintSpeed = 680.f;

	/** Slightly slower while locked on, for controlled strafing. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Movement", meta = (ClampMin = "50.0"))
	float LockOnStrafeSpeed = 380.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Movement", meta = (ClampMin = "0.0"))
	float SprintStaminaDrainPerSecond = 12.f;

	/** Releasing Shift within this window counts as a tap = dodge roll. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Dodge", meta = (ClampMin = "0.05", ClampMax = "1.0"))
	float SprintTapDodgeThreshold = 0.3f;

	// ---- Dodge tuning ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Dodge", meta = (ClampMin = "0.0"))
	float DodgeStaminaCost = 25.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Dodge", meta = (ClampMin = "0.0"))
	float DodgeStartupTime = 0.06f;

	/** i-frame window — the player is invulnerable for exactly this phase. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Dodge", meta = (ClampMin = "0.05"))
	float DodgeActiveTime = 0.30f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Dodge", meta = (ClampMin = "0.0"))
	float DodgeRecoveryTime = 0.22f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Dodge", meta = (ClampMin = "100.0"))
	float DodgeSpeed = 820.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Animation")
	TObjectPtr<UAnimMontage> DodgeMontage;

	// ---- Altar rest ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Animation")
	TObjectPtr<UAnimMontage> RestMontage;

	/** Rest montage is slowed to read as a kneel (placeholder until a real sit anim). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Animation", meta = (ClampMin = "0.05"))
	float RestMontagePlayRate = 0.25f;

	/** Fraction of the rest montage at which the pose freezes (deepest kneel point). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Animation", meta = (ClampMin = "0.05", ClampMax = "0.95"))
	float RestPoseFreezeFraction = 0.3f;

	// ---- Attacks (data-driven; tune in editor) ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Attacks")
	TArray<FAV_AttackData> LightAttackCombo;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Attacks")
	FAV_AttackData HeavyAttack;

	// ---- Ashen Flask ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Flask", meta = (ClampMin = "0"))
	int32 MaxFlaskCharges = 3;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Flask", meta = (ClampMin = "1.0"))
	float FlaskHealAmount = 45.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Flask", meta = (ClampMin = "0.0"))
	float FlaskUseCooldown = 1.2f;

private:
	void CreateDefaultInputAssetsIfNeeded();
	void TickDodge(float DeltaTime);
	void TickSprint(float DeltaTime);
	bool TryStartAttack(bool bHeavy);
	void StartBufferedAttackIfAny();
	void TryDodge();

	int32 AshCount = 0;
	int32 FlaskCharges = 3;
	float LastFlaskUseTime = -10.f;
	bool bResting = false;
	FTimerHandle RestTimer;

	// Sprint (tap = dodge, hold = sprint)
	bool bWantsToSprint = false;
	float SprintPressTime = -10.f;

	// Dodge state
	float DodgeTimeElapsed = 0.f;
	int32 DodgePhase = -1; // -1 none, 0 startup, 1 active (i-frames), 2 recovery
	FVector DodgeDirection = FVector::ForwardVector;
	FRotator MeshBaseRelativeRotation = FRotator(0.f, -90.f, 0.f); // captured at BeginPlay
	FVector MeshBaseRelativeLocation = FVector(0.f, 0.f, -89.f);   // captured at BeginPlay
	FVector2D LastMoveInput = FVector2D::ZeroVector;

	// Attack combo / buffering
	int32 LightComboIndex = 0;
	bool bBufferedLight = false;
	bool bBufferedHeavy = false;
};

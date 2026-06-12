#include "Characters/AV_PlayerCharacter.h"
#include "Components/AV_HealthComponent.h"
#include "Components/AV_StaminaComponent.h"
#include "Components/AV_MeleeCombatComponent.h"
#include "Components/AV_LockOnComponent.h"
#include "Components/AV_InteractionComponent.h"
#include "Core/AV_GameMode.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/CapsuleComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "InputActionValue.h"
#include "Animation/AnimInstance.h"
#include "Engine/LocalPlayer.h"

namespace
{
	UInputAction* MakeRuntimeAction(UObject* Outer, EInputActionValueType ValueType)
	{
		UInputAction* Action = NewObject<UInputAction>(Outer);
		Action->ValueType = ValueType;
		return Action;
	}
}

AAV_PlayerCharacter::AAV_PlayerCharacter()
{
	GetCapsuleComponent()->InitCapsuleSize(42.f, 96.f);
	Tags.Add(FName("Player"));

	// Soulslike movement: character faces movement direction, camera is independent.
	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	UCharacterMovementComponent* Movement = GetCharacterMovement();
	Movement->bOrientRotationToMovement = true;
	Movement->RotationRate = FRotator(0.f, 540.f, 0.f);
	Movement->MaxWalkSpeed = RunSpeed;
	Movement->BrakingDecelerationWalking = 1800.f;
	Movement->MaxAcceleration = 1700.f; // weighty, not arcade-instant
	Movement->JumpZVelocity = 600.f;
	Movement->AirControl = 0.3f;

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = 420.f;
	CameraBoom->bUsePawnControlRotation = true;
	CameraBoom->bEnableCameraLag = true;
	CameraBoom->CameraLagSpeed = 14.f;
	CameraBoom->SocketOffset = FVector(0.f, 0.f, 45.f);

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;

	LockOnComponent = CreateDefaultSubobject<UAV_LockOnComponent>(TEXT("LockOnComponent"));
	InteractionComponent = CreateDefaultSubobject<UAV_InteractionComponent>(TEXT("InteractionComponent"));

	MeleeCombatComponent->TargetTag = FName("Enemy");

	// Default attack data — tune freely in the editor / BP child.
	FAV_AttackData Light1;
	Light1.AttackName = FName("Light_1");
	Light1.Damage = 15.f;  Light1.PoiseDamage = 20.f; Light1.StaminaCost = 12.f;
	Light1.StartupTime = 0.25f; Light1.ActiveTime = 0.15f; Light1.RecoveryTime = 0.40f;
	Light1.Range = 120.f; Light1.Radius = 55.f; Light1.LungeImpulse = 220.f;

	FAV_AttackData Light2 = Light1;
	Light2.AttackName = FName("Light_2");
	Light2.Damage = 18.f; Light2.PoiseDamage = 25.f; Light2.StaminaCost = 14.f;
	Light2.StartupTime = 0.22f; Light2.RecoveryTime = 0.50f; Light2.LungeImpulse = 260.f;

	LightAttackCombo = { Light1, Light2 };

	HeavyAttack.AttackName = FName("Heavy");
	HeavyAttack.Damage = 32.f; HeavyAttack.PoiseDamage = 45.f; HeavyAttack.StaminaCost = 26.f;
	HeavyAttack.StartupTime = 0.55f; HeavyAttack.ActiveTime = 0.20f; HeavyAttack.RecoveryTime = 0.70f;
	HeavyAttack.Range = 140.f; HeavyAttack.Radius = 60.f; HeavyAttack.LungeImpulse = 320.f;
}

void AAV_PlayerCharacter::BeginPlay()
{
	Super::BeginPlay();

	FlaskCharges = MaxFlaskCharges;
	OnFlasksChanged.Broadcast(FlaskCharges, MaxFlaskCharges);
	OnAshChanged.Broadcast(AshCount);

	LockOnComponent->OnTargetLocked.AddDynamic(this, &AAV_PlayerCharacter::HandleTargetLocked);
	LockOnComponent->OnTargetReleased.AddDynamic(this, &AAV_PlayerCharacter::HandleTargetReleased);
	MeleeCombatComponent->OnAttackFinished.AddDynamic(this, &AAV_PlayerCharacter::HandleAttackFinished);
}

void AAV_PlayerCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	CreateDefaultInputAssetsIfNeeded();

	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
			ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			Subsystem->AddMappingContext(DefaultMappingContext, 0);
		}
	}

	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!Input)
	{
		return;
	}

	Input->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AAV_PlayerCharacter::Input_Move);
	Input->BindAction(LookAction, ETriggerEvent::Triggered, this, &AAV_PlayerCharacter::Input_Look);
	Input->BindAction(SprintAction, ETriggerEvent::Started, this, &AAV_PlayerCharacter::Input_SprintStart);
	Input->BindAction(SprintAction, ETriggerEvent::Completed, this, &AAV_PlayerCharacter::Input_SprintStop);
	Input->BindAction(DodgeAction, ETriggerEvent::Started, this, &AAV_PlayerCharacter::Input_Dodge);
	Input->BindAction(LightAttackAction, ETriggerEvent::Started, this, &AAV_PlayerCharacter::Input_LightAttack);
	Input->BindAction(HeavyAttackAction, ETriggerEvent::Started, this, &AAV_PlayerCharacter::Input_HeavyAttack);
	Input->BindAction(InteractAction, ETriggerEvent::Started, this, &AAV_PlayerCharacter::Input_Interact);
	Input->BindAction(UseFlaskAction, ETriggerEvent::Started, this, &AAV_PlayerCharacter::Input_UseFlask);
	Input->BindAction(LockOnAction, ETriggerEvent::Started, this, &AAV_PlayerCharacter::Input_ToggleLockOn);

	if (JumpAction)
	{
		Input->BindAction(JumpAction, ETriggerEvent::Started, this, &ACharacter::Jump);
		Input->BindAction(JumpAction, ETriggerEvent::Completed, this, &ACharacter::StopJumping);
	}
}

void AAV_PlayerCharacter::CreateDefaultInputAssetsIfNeeded()
{
	if (DefaultMappingContext)
	{
		return; // assets assigned in the editor win
	}

	DefaultMappingContext = NewObject<UInputMappingContext>(this);

	if (!MoveAction)        { MoveAction        = MakeRuntimeAction(this, EInputActionValueType::Axis2D); }
	if (!LookAction)        { LookAction        = MakeRuntimeAction(this, EInputActionValueType::Axis2D); }
	if (!SprintAction)      { SprintAction      = MakeRuntimeAction(this, EInputActionValueType::Boolean); }
	if (!DodgeAction)       { DodgeAction       = MakeRuntimeAction(this, EInputActionValueType::Boolean); }
	if (!LightAttackAction) { LightAttackAction = MakeRuntimeAction(this, EInputActionValueType::Boolean); }
	if (!HeavyAttackAction) { HeavyAttackAction = MakeRuntimeAction(this, EInputActionValueType::Boolean); }
	if (!InteractAction)    { InteractAction    = MakeRuntimeAction(this, EInputActionValueType::Boolean); }
	if (!UseFlaskAction)    { UseFlaskAction    = MakeRuntimeAction(this, EInputActionValueType::Boolean); }
	if (!LockOnAction)      { LockOnAction      = MakeRuntimeAction(this, EInputActionValueType::Boolean); }

	// WASD -> 2D axis. W/S land on Y via swizzle, A is negated X.
	{
		FEnhancedActionKeyMapping& W = DefaultMappingContext->MapKey(MoveAction, EKeys::W);
		UInputModifierSwizzleAxis* SwzW = NewObject<UInputModifierSwizzleAxis>(DefaultMappingContext);
		W.Modifiers.Add(SwzW);

		FEnhancedActionKeyMapping& S = DefaultMappingContext->MapKey(MoveAction, EKeys::S);
		UInputModifierSwizzleAxis* SwzS = NewObject<UInputModifierSwizzleAxis>(DefaultMappingContext);
		UInputModifierNegate* NegS = NewObject<UInputModifierNegate>(DefaultMappingContext);
		S.Modifiers.Add(SwzS);
		S.Modifiers.Add(NegS);

		FEnhancedActionKeyMapping& A = DefaultMappingContext->MapKey(MoveAction, EKeys::A);
		UInputModifierNegate* NegA = NewObject<UInputModifierNegate>(DefaultMappingContext);
		A.Modifiers.Add(NegA);

		DefaultMappingContext->MapKey(MoveAction, EKeys::D);
	}

	// Mouse look. Y is negated so mouse-up looks up.
	{
		FEnhancedActionKeyMapping& Mouse = DefaultMappingContext->MapKey(LookAction, EKeys::Mouse2D);
		UInputModifierNegate* NegY = NewObject<UInputModifierNegate>(DefaultMappingContext);
		NegY->bX = false; NegY->bY = true; NegY->bZ = false;
		Mouse.Modifiers.Add(NegY);
	}

	DefaultMappingContext->MapKey(SprintAction, EKeys::LeftShift);
	DefaultMappingContext->MapKey(DodgeAction, EKeys::SpaceBar);
	DefaultMappingContext->MapKey(LightAttackAction, EKeys::LeftMouseButton);
	DefaultMappingContext->MapKey(HeavyAttackAction, EKeys::RightMouseButton);
	DefaultMappingContext->MapKey(InteractAction, EKeys::F);
	DefaultMappingContext->MapKey(UseFlaskAction, EKeys::R);
	DefaultMappingContext->MapKey(LockOnAction, EKeys::Q);
}

void AAV_PlayerCharacter::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);
	TickDodge(DeltaTime);
	TickSprint(DeltaTime);
}

// ---------------- Input handlers ----------------

void AAV_PlayerCharacter::Input_Move(const FInputActionValue& Value)
{
	const FVector2D MoveValue = Value.Get<FVector2D>();
	LastMoveInput = MoveValue;

	if (!Controller || !IsAlive())
	{
		return;
	}
	// Movement is committed during dodge/attack/stagger/rest — no steering mid-action.
	if (ActionState == EAV_ActionState::Dodging ||
		ActionState == EAV_ActionState::Attacking ||
		ActionState == EAV_ActionState::Staggered ||
		ActionState == EAV_ActionState::Interacting)
	{
		return;
	}

	const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
	const FVector Forward = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
	const FVector Right = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

	AddMovementInput(Forward, MoveValue.Y);
	AddMovementInput(Right, MoveValue.X);
}

void AAV_PlayerCharacter::Input_Look(const FInputActionValue& Value)
{
	// While locked on, the lock-on component owns the camera.
	if (LockOnComponent->IsLockedOn())
	{
		return;
	}

	const FVector2D LookValue = Value.Get<FVector2D>();
	AddControllerYawInput(LookValue.X);
	AddControllerPitchInput(LookValue.Y);
}

void AAV_PlayerCharacter::Input_SprintStart(const FInputActionValue& Value)
{
	bWantsToSprint = true;
}

void AAV_PlayerCharacter::Input_SprintStop(const FInputActionValue& Value)
{
	bWantsToSprint = false;
}

void AAV_PlayerCharacter::Input_Dodge(const FInputActionValue& Value)
{
	if (ActionState != EAV_ActionState::Idle || !IsAlive())
	{
		return;
	}
	if (!StaminaComponent->Consume(DodgeStaminaCost))
	{
		return;
	}

	// Roll in the input direction (camera-relative); no input = backstep.
	if (!LastMoveInput.IsNearlyZero() && Controller)
	{
		const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
		const FVector Forward = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
		const FVector Right = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);
		DodgeDirection = (Forward * LastMoveInput.Y + Right * LastMoveInput.X).GetSafeNormal();
	}
	else
	{
		DodgeDirection = -GetActorForwardVector();
	}

	if (!LockOnComponent->IsLockedOn())
	{
		SetActorRotation(FRotator(0.f, DodgeDirection.Rotation().Yaw, 0.f));
	}

	SetActionState(EAV_ActionState::Dodging);
	DodgePhase = 0;
	DodgeTimeElapsed = 0.f;
	PlayMontageIfSet(DodgeMontage);
	OnDodgeBP(DodgeDirection);
}

void AAV_PlayerCharacter::Input_LightAttack(const FInputActionValue& Value)
{
	if (!TryStartAttack(false))
	{
		bBufferedLight = true;
	}
}

void AAV_PlayerCharacter::Input_HeavyAttack(const FInputActionValue& Value)
{
	if (!TryStartAttack(true))
	{
		bBufferedHeavy = true;
	}
}

void AAV_PlayerCharacter::Input_Interact(const FInputActionValue& Value)
{
	if (ActionState == EAV_ActionState::Idle && IsAlive())
	{
		InteractionComponent->TryInteract();
	}
}

void AAV_PlayerCharacter::Input_UseFlask(const FInputActionValue& Value)
{
	if (ActionState != EAV_ActionState::Idle || !IsAlive() || FlaskCharges <= 0)
	{
		return;
	}
	if (GetWorld()->GetTimeSeconds() - LastFlaskUseTime < FlaskUseCooldown)
	{
		return;
	}
	if (HealthComponent->GetCurrentHealth() >= HealthComponent->GetMaxHealth())
	{
		return;
	}

	LastFlaskUseTime = GetWorld()->GetTimeSeconds();
	--FlaskCharges;
	HealthComponent->Heal(FlaskHealAmount);
	OnFlasksChanged.Broadcast(FlaskCharges, MaxFlaskCharges);
	OnFlaskUsedBP();
}

void AAV_PlayerCharacter::Input_ToggleLockOn(const FInputActionValue& Value)
{
	if (IsAlive())
	{
		LockOnComponent->ToggleLockOn();
	}
}

// ---------------- Lock-on movement modes ----------------

void AAV_PlayerCharacter::HandleTargetLocked(AActor* NewTarget)
{
	UCharacterMovementComponent* Movement = GetCharacterMovement();
	Movement->bOrientRotationToMovement = false;
	Movement->bUseControllerDesiredRotation = true; // strafe: face the target with the controller
	Movement->MaxWalkSpeed = bWantsToSprint ? SprintSpeed : LockOnStrafeSpeed;
}

void AAV_PlayerCharacter::HandleTargetReleased()
{
	UCharacterMovementComponent* Movement = GetCharacterMovement();
	Movement->bOrientRotationToMovement = true;
	Movement->bUseControllerDesiredRotation = false;
	Movement->MaxWalkSpeed = bWantsToSprint ? SprintSpeed : RunSpeed;
}

// ---------------- Dodge ----------------

void AAV_PlayerCharacter::TickDodge(float DeltaTime)
{
	if (DodgePhase < 0)
	{
		return;
	}

	// Stagger/death interrupted the dodge — clean up i-frames immediately.
	if (ActionState != EAV_ActionState::Dodging)
	{
		HealthComponent->SetInvulnerable(false);
		DodgePhase = -1;
		return;
	}

	DodgeTimeElapsed += DeltaTime;

	if (DodgePhase == 0 && DodgeTimeElapsed >= DodgeStartupTime)
	{
		DodgePhase = 1;
		HealthComponent->SetInvulnerable(true);
	}

	if (DodgePhase == 1)
	{
		// Drive the roll directly so distance is deterministic; gravity stays intact.
		FVector Velocity = DodgeDirection * DodgeSpeed;
		Velocity.Z = GetCharacterMovement()->Velocity.Z;
		GetCharacterMovement()->Velocity = Velocity;

		if (DodgeTimeElapsed >= DodgeStartupTime + DodgeActiveTime)
		{
			DodgePhase = 2;
			HealthComponent->SetInvulnerable(false);
		}
	}

	if (DodgePhase == 2 && DodgeTimeElapsed >= DodgeStartupTime + DodgeActiveTime + DodgeRecoveryTime)
	{
		DodgePhase = -1;
		SetActionState(EAV_ActionState::Idle);
		StartBufferedAttackIfAny();
	}
}

// ---------------- Sprint ----------------

void AAV_PlayerCharacter::TickSprint(float DeltaTime)
{
	UCharacterMovementComponent* Movement = GetCharacterMovement();
	const bool bMoving = Movement->Velocity.SizeSquared2D() > FMath::Square(80.f);
	const bool bSprinting = bWantsToSprint && bMoving && !StaminaComponent->IsExhausted() &&
		ActionState == EAV_ActionState::Idle;

	if (bSprinting)
	{
		StaminaComponent->Drain(SprintStaminaDrainPerSecond * DeltaTime);
		Movement->MaxWalkSpeed = SprintSpeed;
	}
	else
	{
		Movement->MaxWalkSpeed = LockOnComponent->IsLockedOn() ? LockOnStrafeSpeed : RunSpeed;
	}
}

// ---------------- Attacks ----------------

bool AAV_PlayerCharacter::TryStartAttack(bool bHeavy)
{
	if (!IsAlive())
	{
		return false;
	}

	const bool bIdle = ActionState == EAV_ActionState::Idle;
	const bool bComboCancel = ActionState == EAV_ActionState::Attacking && MeleeCombatComponent->CanComboCancel();
	if (!bIdle && !bComboCancel)
	{
		return false;
	}

	if (bHeavy || LightAttackCombo.Num() == 0)
	{
		LightComboIndex = 0;
	}
	const FAV_AttackData& Attack = (bHeavy || LightAttackCombo.Num() == 0)
		? HeavyAttack
		: LightAttackCombo[LightComboIndex % LightAttackCombo.Num()];

	if (!StaminaComponent->CanAfford(Attack.StaminaCost))
	{
		return false;
	}

	// Commit to the target before swinging.
	if (AActor* Target = LockOnComponent->GetCurrentTarget())
	{
		const FVector ToTarget = Target->GetActorLocation() - GetActorLocation();
		SetActorRotation(FRotator(0.f, ToTarget.Rotation().Yaw, 0.f));
	}

	if (!MeleeCombatComponent->BeginAttack(Attack))
	{
		return false;
	}

	StaminaComponent->Consume(Attack.StaminaCost);
	SetActionState(EAV_ActionState::Attacking);
	OnAttackStartedBP(Attack);

	if (!bHeavy && LightAttackCombo.Num() > 0)
	{
		LightComboIndex = (LightComboIndex + 1) % LightAttackCombo.Num();
	}
	return true;
}

void AAV_PlayerCharacter::HandleAttackFinished()
{
	if (ActionState == EAV_ActionState::Attacking)
	{
		SetActionState(EAV_ActionState::Idle);
	}
	if (!bBufferedLight && !bBufferedHeavy)
	{
		LightComboIndex = 0; // combo drops if no follow-up was queued
	}
	StartBufferedAttackIfAny();
}

void AAV_PlayerCharacter::StartBufferedAttackIfAny()
{
	if (bBufferedHeavy)
	{
		bBufferedHeavy = false;
		bBufferedLight = false;
		TryStartAttack(true);
	}
	else if (bBufferedLight)
	{
		bBufferedLight = false;
		TryStartAttack(false);
	}
}

// ---------------- Death / respawn / resources ----------------

void AAV_PlayerCharacter::HandleDeath(AActor* Victim, AActor* Killer)
{
	HealthComponent->SetInvulnerable(false);
	DodgePhase = -1;
	bBufferedLight = bBufferedHeavy = false;
	LockOnComponent->ReleaseTarget();

	Super::HandleDeath(Victim, Killer);

	if (AAV_GameMode* GameMode = GetWorld()->GetAuthGameMode<AAV_GameMode>())
	{
		GameMode->HandlePlayerDeath(this);
	}
}

void AAV_PlayerCharacter::ResetForRespawn(const FTransform& RespawnTransform)
{
	ActionState = EAV_ActionState::Idle; // direct reset — SetActionState treats Dead as terminal
	DodgePhase = -1;
	LightComboIndex = 0;
	bBufferedLight = bBufferedHeavy = false;

	GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Pawn, ECR_Block);
	GetCharacterMovement()->SetMovementMode(MOVE_Walking);
	ResetAnimationState();

	SetActorTransform(RespawnTransform, false, nullptr, ETeleportType::TeleportPhysics);
	if (Controller)
	{
		Controller->SetControlRotation(RespawnTransform.Rotator());
	}

	RestoreAtAltar();
}

void AAV_PlayerCharacter::RestoreAtAltar()
{
	HealthComponent->ResetVitals();
	StaminaComponent->RestoreFull();
	FlaskCharges = MaxFlaskCharges;
	OnFlasksChanged.Broadcast(FlaskCharges, MaxFlaskCharges);
}

void AAV_PlayerCharacter::PlayRestSequence(const FVector& AltarLocation)
{
	if (ActionState != EAV_ActionState::Idle || !IsAlive())
	{
		return;
	}

	const FVector ToAltar = AltarLocation - GetActorLocation();
	SetActorRotation(FRotator(0.f, ToAltar.Rotation().Yaw, 0.f));
	GetCharacterMovement()->StopMovementImmediately();
	LockOnComponent->ReleaseTarget();

	SetActionState(EAV_ActionState::Interacting);
	PlayMontageIfSet(RestMontage, RestMontagePlayRate);
	GetWorldTimerManager().SetTimer(RestTimer, this, &AAV_PlayerCharacter::FinishRest, RestDuration, false);
}

void AAV_PlayerCharacter::FinishRest()
{
	if (UAnimInstance* AnimInstance = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr)
	{
		AnimInstance->StopAllMontages(0.25f);
	}
	if (ActionState == EAV_ActionState::Interacting)
	{
		SetActionState(EAV_ActionState::Idle);
	}
}

void AAV_PlayerCharacter::AddAsh(int32 Amount)
{
	AshCount = FMath::Max(0, AshCount + Amount);
	OnAshChanged.Broadcast(AshCount);
}

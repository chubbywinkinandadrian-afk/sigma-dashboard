#include "Characters/AV_EnemyBase.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Components/AV_HealthComponent.h"
#include "Components/AV_MeleeCombatComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "AIController.h"
#include "Navigation/PathFollowingComponent.h" // EPathFollowingRequestResult definition (5.7+)
#include "Kismet/GameplayStatics.h"
#include "TimerManager.h"
#include "Engine/World.h"

AAV_EnemyBase::AAV_EnemyBase()
{
	Tags.Add(FName("Enemy"));
	MeleeCombatComponent->TargetTag = FName("Player");

	AIControllerClass = AAIController::StaticClass();
	AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;

	UCharacterMovementComponent* Movement = GetCharacterMovement();
	Movement->bOrientRotationToMovement = true;
	Movement->RotationRate = FRotator(0.f, 360.f, 0.f);
	Movement->MaxWalkSpeed = PatrolSpeed;
}

void AAV_EnemyBase::BeginPlay()
{
	Super::BeginPlay();

	HomeTransform = GetActorTransform();
	MeleeCombatComponent->OnAttackFinished.AddDynamic(this, &AAV_EnemyBase::HandleAttackSequenceFinished);

	SetEnemyState(PatrolPoints.Num() > 0 ? EAV_EnemyState::Patrol : EAV_EnemyState::Idle);
}

void AAV_EnemyBase::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	if (EnemyState == EAV_EnemyState::Dead || ActionState == EAV_ActionState::Staggered)
	{
		return;
	}

	switch (EnemyState)
	{
	case EAV_EnemyState::Idle:      TickIdle(); break;
	case EAV_EnemyState::Patrol:    TickPatrol(); break;
	case EAV_EnemyState::Chase:     TickChase(DeltaTime); break;
	case EAV_EnemyState::Combat:    TickCombat(DeltaTime); break;
	case EAV_EnemyState::Returning: TickReturning(); break;
	default: break;
	}
}

// ---------------- Targetable ----------------

bool AAV_EnemyBase::IsTargetable_Implementation()
{
	return IsAlive();
}

FVector AAV_EnemyBase::GetTargetPoint_Implementation()
{
	return GetActorLocation() + FVector(0.f, 0.f, 40.f);
}

// ---------------- States ----------------

void AAV_EnemyBase::SetEnemyState(EAV_EnemyState NewState)
{
	if (EnemyState == NewState)
	{
		return;
	}
	EnemyState = NewState;

	UCharacterMovementComponent* Movement = GetCharacterMovement();
	switch (NewState)
	{
	case EAV_EnemyState::Patrol:
	case EAV_EnemyState::Idle:
		Movement->MaxWalkSpeed = PatrolSpeed;
		break;
	case EAV_EnemyState::Chase:
	case EAV_EnemyState::Returning:
		Movement->MaxWalkSpeed = ChaseSpeed;
		break;
	case EAV_EnemyState::Combat:
		Movement->MaxWalkSpeed = ChaseSpeed * 0.6f;
		break;
	default:
		break;
	}

	OnEnemyStateChangedBP(NewState);
}

void AAV_EnemyBase::TickIdle()
{
	if (APawn* Player = FindPlayerIfDetectable())
	{
		TargetPlayer = Player;
		SetEnemyState(EAV_EnemyState::Chase);
	}
}

void AAV_EnemyBase::TickPatrol()
{
	if (APawn* Player = FindPlayerIfDetectable())
	{
		TargetPlayer = Player;
		StopMoving();
		SetEnemyState(EAV_EnemyState::Chase);
		return;
	}

	if (PatrolPoints.Num() == 0)
	{
		SetEnemyState(EAV_EnemyState::Idle);
		return;
	}

	const FVector Destination = PatrolPoints[CurrentPatrolIndex % PatrolPoints.Num()];
	const float DistSq = FVector::DistSquared2D(GetActorLocation(), Destination);

	if (DistSq < FMath::Square(100.f))
	{
		PatrolWaitElapsed += GetWorld()->GetDeltaSeconds();
		if (PatrolWaitElapsed >= PatrolWaitTime)
		{
			PatrolWaitElapsed = 0.f;
			CurrentPatrolIndex = (CurrentPatrolIndex + 1) % PatrolPoints.Num();
		}
	}
	else
	{
		MoveTowards(Destination, 80.f);
	}
}

void AAV_EnemyBase::TickChase(float DeltaTime)
{
	AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(TargetPlayer);
	const bool bLostTarget = !Player || !Player->IsAlive();
	const bool bPastLeash =
		FVector::DistSquared(GetActorLocation(), HomeTransform.GetLocation()) > FMath::Square(LeashRadius);

	if (bLostTarget || bPastLeash)
	{
		TargetPlayer = nullptr;
		StopMoving();
		SetEnemyState(EAV_EnemyState::Returning);
		return;
	}

	const float DistToPlayer = FVector::Dist(GetActorLocation(), Player->GetActorLocation());
	if (DistToPlayer <= AttackRange)
	{
		StopMoving();
		AttackCooldownRemaining = FMath::FRandRange(0.2f, 0.6f); // brief read before the first swing
		SetEnemyState(EAV_EnemyState::Combat);
		return;
	}

	RepathElapsed += DeltaTime;
	if (RepathElapsed >= 0.4f)
	{
		RepathElapsed = 0.f;
		MoveTowards(Player->GetActorLocation(), AttackRange * 0.7f);
	}
	else if (bDirectMoveFallback)
	{
		// No navmesh: keep feeding input every tick between repath attempts.
		const FVector Direction = (Player->GetActorLocation() - GetActorLocation()).GetSafeNormal2D();
		GetCharacterMovement()->AddInputVector(Direction);
	}
}

void AAV_EnemyBase::TickCombat(float DeltaTime)
{
	AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(TargetPlayer);
	if (!Player || !Player->IsAlive())
	{
		TargetPlayer = nullptr;
		SetEnemyState(EAV_EnemyState::Returning);
		return;
	}

	const float DistToPlayer = FVector::Dist(GetActorLocation(), Player->GetActorLocation());

	if (bAttackInProgress)
	{
		// Committed: only track the player during windup, never mid-swing.
		if (MeleeCombatComponent->GetAttackPhase() == EAV_AttackPhase::Startup)
		{
			FaceTowards(Player->GetActorLocation(), DeltaTime, 4.f);
		}
		return;
	}

	if (DistToPlayer > AttackRange * 1.35f)
	{
		SetEnemyState(EAV_EnemyState::Chase);
		return;
	}

	FaceTowards(Player->GetActorLocation(), DeltaTime);

	AttackCooldownRemaining -= DeltaTime;
	if (AttackCooldownRemaining <= 0.f && ActionState == EAV_ActionState::Idle)
	{
		if (const FAV_AttackData* Attack = ChooseNextAttack())
		{
			if (MeleeCombatComponent->BeginAttack(*Attack))
			{
				bAttackInProgress = true;
				SetActionState(EAV_ActionState::Attacking);
			}
		}
	}
}

void AAV_EnemyBase::TickReturning()
{
	// Re-aggro if the player comes back into view on the way home.
	if (APawn* Player = FindPlayerIfDetectable())
	{
		TargetPlayer = Player;
		SetEnemyState(EAV_EnemyState::Chase);
		return;
	}

	const float DistSq = FVector::DistSquared2D(GetActorLocation(), HomeTransform.GetLocation());
	if (DistSq < FMath::Square(120.f))
	{
		HealthComponent->ResetVitals(); // classic Soulslike: escaping resets the enemy
		SetActorRotation(HomeTransform.GetRotation());
		SetEnemyState(PatrolPoints.Num() > 0 ? EAV_EnemyState::Patrol : EAV_EnemyState::Idle);
	}
	else
	{
		MoveTowards(HomeTransform.GetLocation(), 90.f);
	}
}

// ---------------- Combat helpers ----------------

const FAV_AttackData* AAV_EnemyBase::ChooseNextAttack()
{
	if (AttackCombo.Num() == 0)
	{
		return nullptr;
	}
	return &AttackCombo[ComboAttackIndex % AttackCombo.Num()];
}

void AAV_EnemyBase::HandleAttackSequenceFinished()
{
	bAttackInProgress = false;
	if (ActionState == EAV_ActionState::Attacking)
	{
		SetActionState(EAV_ActionState::Idle);
	}

	const bool bContinueCombo =
		AttackCombo.Num() > 1 &&
		(ComboAttackIndex % AttackCombo.Num()) != AttackCombo.Num() - 1 &&
		FMath::FRand() <= ComboContinueChance;

	if (bContinueCombo)
	{
		ComboAttackIndex++;
		AttackCooldownRemaining = 0.15f; // tight chain into the follow-up swing
	}
	else
	{
		ComboAttackIndex = 0;
		AttackCooldownRemaining = FMath::FRandRange(AttackCooldownMin, AttackCooldownMax);
	}
}

// ---------------- Perception / movement ----------------

APawn* AAV_EnemyBase::FindPlayerIfDetectable() const
{
	AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(UGameplayStatics::GetPlayerCharacter(this, 0));
	if (!Player || !Player->IsAlive())
	{
		return nullptr;
	}

	const float DistSq = FVector::DistSquared(GetActorLocation(), Player->GetActorLocation());
	if (DistSq > FMath::Square(DetectRadius))
	{
		return nullptr;
	}
	if (bRequireLineOfSightToDetect && !CanSee(Player))
	{
		return nullptr;
	}
	return Player;
}

bool AAV_EnemyBase::CanSee(const AActor* Target) const
{
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(AVEnemyLOS), false, this);
	Params.AddIgnoredActor(Target);

	const FVector Start = GetActorLocation() + FVector(0.f, 0.f, 50.f);
	const FVector End = Target->GetActorLocation() + FVector(0.f, 0.f, 50.f);
	return !GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params);
}

void AAV_EnemyBase::MoveTowards(const FVector& Destination, float AcceptanceRadius)
{
	AAIController* AI = Cast<AAIController>(GetController());
	bool bNavMoveStarted = false;

	if (AI)
	{
		const EPathFollowingRequestResult::Type Result = AI->MoveToLocation(
			Destination, AcceptanceRadius, true, true, false, true);
		bNavMoveStarted = Result == EPathFollowingRequestResult::RequestSuccessful ||
			Result == EPathFollowingRequestResult::AlreadyAtGoal;
	}

	bDirectMoveFallback = !bNavMoveStarted;
	if (bDirectMoveFallback)
	{
		// No navmesh (or path failed): walk straight at the destination.
		const FVector Direction = (Destination - GetActorLocation()).GetSafeNormal2D();
		GetCharacterMovement()->AddInputVector(Direction);
	}
}

void AAV_EnemyBase::FaceTowards(const FVector& Point, float DeltaTime, float Speed)
{
	const FVector ToPoint = Point - GetActorLocation();
	const FRotator Desired(0.f, ToPoint.Rotation().Yaw, 0.f);
	SetActorRotation(FMath::RInterpTo(GetActorRotation(), Desired, DeltaTime, Speed));
}

void AAV_EnemyBase::StopMoving()
{
	bDirectMoveFallback = false;
	if (AAIController* AI = Cast<AAIController>(GetController()))
	{
		AI->StopMovement();
	}
}

// ---------------- Damage / death / respawn ----------------

void AAV_EnemyBase::HandleDamaged(float DamageAmount, const FAV_DamageInfo& DamageInfo)
{
	Super::HandleDamaged(DamageAmount, DamageInfo);

	// Being hit reveals the attacker even outside the detect radius.
	if (EnemyState != EAV_EnemyState::Dead && EnemyState != EAV_EnemyState::Chase &&
		EnemyState != EAV_EnemyState::Combat)
	{
		if (APawn* Attacker = Cast<APawn>(DamageInfo.InstigatorActor))
		{
			if (Attacker->ActorHasTag(FName("Player")))
			{
				TargetPlayer = Attacker;
				SetEnemyState(EAV_EnemyState::Chase);
			}
		}
	}
}

void AAV_EnemyBase::EnterStagger(float Duration)
{
	bAttackInProgress = false;
	StopMoving();
	Super::EnterStagger(Duration);
}

void AAV_EnemyBase::HandleDeath(AActor* Victim, AActor* Killer)
{
	SetEnemyState(EAV_EnemyState::Dead);
	StopMoving();

	if (AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(Killer))
	{
		Player->AddAsh(AshReward);
	}

	Super::HandleDeath(Victim, Killer);

	GetWorldTimerManager().SetTimer(CorpseTimer, this, &AAV_EnemyBase::DeactivateCorpse, CorpseLingerTime, false);
}

void AAV_EnemyBase::DeactivateCorpse()
{
	SetActorHiddenInGame(true);
	SetActorEnableCollision(false);
	SetActorTickEnabled(false);
}

void AAV_EnemyBase::ResetForRespawn()
{
	if (!bRespawnsOnRest)
	{
		return;
	}

	GetWorldTimerManager().ClearTimer(CorpseTimer);

	SetActorHiddenInGame(false);
	SetActorEnableCollision(true);
	SetActorTickEnabled(true);
	GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Pawn, ECR_Block);
	GetCharacterMovement()->SetMovementMode(MOVE_Walking);

	ActionState = EAV_ActionState::Idle; // direct reset — Dead is otherwise terminal
	HealthComponent->ResetVitals();
	MeleeCombatComponent->AbortAttack();

	TargetPlayer = nullptr;
	bAttackInProgress = false;
	ComboAttackIndex = 0;
	CurrentPatrolIndex = 0;
	PatrolWaitElapsed = 0.f;

	SetActorTransform(HomeTransform, false, nullptr, ETeleportType::TeleportPhysics);
	EnemyState = EAV_EnemyState::Dead; // force the state-change broadcast below
	SetEnemyState(PatrolPoints.Num() > 0 ? EAV_EnemyState::Patrol : EAV_EnemyState::Idle);
}

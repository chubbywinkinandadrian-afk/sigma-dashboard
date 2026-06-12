#include "Components/AV_MeleeCombatComponent.h"
#include "Components/AV_HealthComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Animation/AnimInstance.h"
#include "DrawDebugHelpers.h"
#include "Engine/OverlapResult.h"
#include "Engine/World.h"

UAV_MeleeCombatComponent::UAV_MeleeCombatComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

bool UAV_MeleeCombatComponent::BeginAttack(const FAV_AttackData& AttackData)
{
	const bool bCanStart = CurrentPhase == EAV_AttackPhase::None ||
		(CurrentPhase == EAV_AttackPhase::Recovery && CanComboCancel());

	if (!bCanStart)
	{
		return false;
	}

	ActiveAttack = AttackData;
	HitActorsThisSwing.Reset();

	if (ActiveAttack.Montage)
	{
		if (const ACharacter* Character = Cast<ACharacter>(GetOwner()))
		{
			if (UAnimInstance* AnimInstance = Character->GetMesh() ? Character->GetMesh()->GetAnimInstance() : nullptr)
			{
				AnimInstance->Montage_Play(ActiveAttack.Montage);
			}
		}
	}

	EnterPhase(EAV_AttackPhase::Startup);
	return true;
}

void UAV_MeleeCombatComponent::AbortAttack()
{
	if (CurrentPhase == EAV_AttackPhase::None)
	{
		return;
	}

	if (ActiveAttack.Montage)
	{
		if (const ACharacter* Character = Cast<ACharacter>(GetOwner()))
		{
			if (UAnimInstance* AnimInstance = Character->GetMesh() ? Character->GetMesh()->GetAnimInstance() : nullptr)
			{
				AnimInstance->Montage_Stop(0.15f, ActiveAttack.Montage);
			}
		}
	}

	CurrentPhase = EAV_AttackPhase::None;
	PhaseTimeElapsed = 0.f;
	HitActorsThisSwing.Reset();
	OnAttackPhaseChanged.Broadcast(EAV_AttackPhase::None);
}

bool UAV_MeleeCombatComponent::CanComboCancel() const
{
	if (CurrentPhase != EAV_AttackPhase::Recovery)
	{
		return false;
	}
	return PhaseTimeElapsed >= ActiveAttack.RecoveryTime * ComboCancelFraction;
}

void UAV_MeleeCombatComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (CurrentPhase == EAV_AttackPhase::None)
	{
		return;
	}

	PhaseTimeElapsed += DeltaTime;

	if (CurrentPhase == EAV_AttackPhase::Active)
	{
		PerformHitSweep();
	}

	const float PhaseDuration =
		CurrentPhase == EAV_AttackPhase::Startup ? ActiveAttack.StartupTime :
		CurrentPhase == EAV_AttackPhase::Active ? ActiveAttack.ActiveTime :
		ActiveAttack.RecoveryTime;

	if (PhaseTimeElapsed >= PhaseDuration)
	{
		AdvancePhase();
	}
}

void UAV_MeleeCombatComponent::EnterPhase(EAV_AttackPhase NewPhase)
{
	CurrentPhase = NewPhase;
	PhaseTimeElapsed = 0.f;
	OnAttackPhaseChanged.Broadcast(NewPhase);

	if (NewPhase == EAV_AttackPhase::Active && ActiveAttack.LungeImpulse > 0.f)
	{
		if (ACharacter* Character = Cast<ACharacter>(GetOwner()))
		{
			Character->LaunchCharacter(Character->GetActorForwardVector() * ActiveAttack.LungeImpulse, false, false);
		}
	}
}

void UAV_MeleeCombatComponent::AdvancePhase()
{
	switch (CurrentPhase)
	{
	case EAV_AttackPhase::Startup:
		EnterPhase(EAV_AttackPhase::Active);
		break;
	case EAV_AttackPhase::Active:
		EnterPhase(EAV_AttackPhase::Recovery);
		break;
	case EAV_AttackPhase::Recovery:
		CurrentPhase = EAV_AttackPhase::None;
		PhaseTimeElapsed = 0.f;
		OnAttackPhaseChanged.Broadcast(EAV_AttackPhase::None);
		OnAttackFinished.Broadcast();
		break;
	default:
		break;
	}
}

void UAV_MeleeCombatComponent::PerformHitSweep()
{
	AActor* Owner = GetOwner();
	UWorld* World = GetWorld();
	if (!Owner || !World)
	{
		return;
	}

	const FVector SweepCenter = Owner->GetActorLocation() + Owner->GetActorForwardVector() * ActiveAttack.Range;
	const FCollisionShape Sphere = FCollisionShape::MakeSphere(ActiveAttack.Radius);

	TArray<FOverlapResult> Overlaps;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(AVMeleeSweep), false, Owner);
	World->OverlapMultiByObjectType(
		Overlaps, SweepCenter, FQuat::Identity,
		FCollisionObjectQueryParams(ECC_Pawn), Sphere, Params);

	if (bDrawDebugHits)
	{
		DrawDebugSphere(World, SweepCenter, ActiveAttack.Radius, 12, FColor::Red, false, 0.15f);
	}

	for (const FOverlapResult& Overlap : Overlaps)
	{
		AActor* HitActor = Overlap.GetActor();
		if (!HitActor || HitActor == Owner || HitActorsThisSwing.Contains(HitActor))
		{
			continue;
		}
		if (!HitActor->ActorHasTag(TargetTag))
		{
			continue;
		}

		UAV_HealthComponent* VictimHealth = HitActor->FindComponentByClass<UAV_HealthComponent>();
		if (!VictimHealth || !VictimHealth->IsAlive())
		{
			continue;
		}

		HitActorsThisSwing.Add(HitActor);

		FAV_DamageInfo DamageInfo;
		DamageInfo.Amount = ActiveAttack.Damage;
		DamageInfo.PoiseDamage = ActiveAttack.PoiseDamage;
		DamageInfo.InstigatorActor = Owner;
		DamageInfo.HitLocation = HitActor->GetActorLocation();

		const float Dealt = VictimHealth->ApplyDamage(DamageInfo);
		if (Dealt > 0.f)
		{
			OnAttackHitLanded.Broadcast(HitActor);
		}
	}
}

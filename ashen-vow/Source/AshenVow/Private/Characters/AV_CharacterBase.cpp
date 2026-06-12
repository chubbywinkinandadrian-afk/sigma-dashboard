#include "Characters/AV_CharacterBase.h"
#include "Components/AV_HealthComponent.h"
#include "Components/AV_StaminaComponent.h"
#include "Components/AV_MeleeCombatComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "TimerManager.h"

AAV_CharacterBase::AAV_CharacterBase()
{
	PrimaryActorTick.bCanEverTick = true;

	HealthComponent = CreateDefaultSubobject<UAV_HealthComponent>(TEXT("HealthComponent"));
	StaminaComponent = CreateDefaultSubobject<UAV_StaminaComponent>(TEXT("StaminaComponent"));
	MeleeCombatComponent = CreateDefaultSubobject<UAV_MeleeCombatComponent>(TEXT("MeleeCombatComponent"));
}

void AAV_CharacterBase::BeginPlay()
{
	Super::BeginPlay();

	HealthComponent->OnDamaged.AddDynamic(this, &AAV_CharacterBase::HandleDamaged);
	HealthComponent->OnPoiseBroken.AddDynamic(this, &AAV_CharacterBase::HandlePoiseBroken);
	HealthComponent->OnDeath.AddDynamic(this, &AAV_CharacterBase::HandleDeath);
}

bool AAV_CharacterBase::IsAlive() const
{
	return HealthComponent && HealthComponent->IsAlive();
}

void AAV_CharacterBase::SetActionState(EAV_ActionState NewState)
{
	if (ActionState == EAV_ActionState::Dead)
	{
		return; // death is terminal until an external respawn resets it
	}
	ActionState = NewState;
}

void AAV_CharacterBase::HandleDamaged(float DamageAmount, const FAV_DamageInfo& DamageInfo)
{
	// Visible flinch on every hit — but never interrupt this character's own
	// attack animation (attack commitment stays intact; stagger handles big hits).
	if (IsAlive() && ActionState != EAV_ActionState::Attacking)
	{
		PlayMontageIfSet(HitReactMontage);
	}

	OnDamagedBP(DamageAmount, DamageInfo);
}

void AAV_CharacterBase::HandlePoiseBroken()
{
	EnterStagger(StaggerDuration);
}

void AAV_CharacterBase::HandleDeath(AActor* Victim, AActor* Killer)
{
	SetActionState(EAV_ActionState::Dead);

	MeleeCombatComponent->AbortAttack();
	GetCharacterMovement()->StopMovementImmediately();
	GetCharacterMovement()->DisableMovement();
	GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Pawn, ECR_Ignore);

	const float DeathAnimLength = PlayMontageIfSet(DeathMontage);
	if (DeathAnimLength > 0.f)
	{
		// Freeze on the corpse pose just before the montage blends back out.
		GetWorldTimerManager().SetTimer(DeathPoseTimer, FTimerDelegate::CreateWeakLambda(this, [this]()
		{
			if (GetMesh())
			{
				GetMesh()->bPauseAnims = true;
			}
		}), DeathAnimLength * 0.92f, false);
	}

	OnDeathBP(Killer);
}

void AAV_CharacterBase::EnterStagger(float Duration)
{
	if (!IsAlive())
	{
		return;
	}

	MeleeCombatComponent->AbortAttack();
	SetActionState(EAV_ActionState::Staggered);
	PlayMontageIfSet(StaggerMontage);
	OnStaggeredBP(Duration);

	GetWorldTimerManager().SetTimer(StaggerTimer, this, &AAV_CharacterBase::ExitStagger, Duration, false);
}

void AAV_CharacterBase::ExitStagger()
{
	if (ActionState == EAV_ActionState::Staggered)
	{
		SetActionState(EAV_ActionState::Idle);
	}
}

float AAV_CharacterBase::PlayMontageIfSet(UAnimMontage* Montage, float PlayRate)
{
	if (!Montage)
	{
		return 0.f;
	}
	if (UAnimInstance* AnimInstance = GetMesh() ? GetMesh()->GetAnimInstance() : nullptr)
	{
		const float MontageLength = AnimInstance->Montage_Play(Montage, PlayRate);
		return MontageLength;
	}
	return 0.f;
}

void AAV_CharacterBase::ResetAnimationState()
{
	GetWorldTimerManager().ClearTimer(DeathPoseTimer);
	if (GetMesh())
	{
		GetMesh()->bPauseAnims = false;
		if (UAnimInstance* AnimInstance = GetMesh()->GetAnimInstance())
		{
			AnimInstance->StopAllMontages(0.2f);
		}
	}
}

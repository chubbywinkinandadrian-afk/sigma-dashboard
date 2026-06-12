#include "Components/AV_HealthComponent.h"
#include "TimerManager.h"

UAV_HealthComponent::UAV_HealthComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UAV_HealthComponent::BeginPlay()
{
	Super::BeginPlay();
	CurrentHealth = MaxHealth;
	CurrentPoise = MaxPoise;
	OnHealthChanged.Broadcast(CurrentHealth, MaxHealth);
}

float UAV_HealthComponent::ApplyDamage(const FAV_DamageInfo& DamageInfo)
{
	if (!IsAlive() || bInvulnerable || DamageInfo.Amount <= 0.f)
	{
		return 0.f;
	}

	const float ScaledAmount = DamageInfo.Amount * IncomingDamageMultiplier;
	const float ActualDamage = FMath::Min(ScaledAmount, CurrentHealth);
	CurrentHealth -= ActualDamage;

	OnHealthChanged.Broadcast(CurrentHealth, MaxHealth);
	OnDamaged.Broadcast(ActualDamage, DamageInfo);

	if (CurrentHealth <= 0.f)
	{
		OnDeath.Broadcast(GetOwner(), DamageInfo.InstigatorActor);
	}
	else
	{
		HandlePoiseDamage(DamageInfo.PoiseDamage);
	}

	return ActualDamage;
}

float UAV_HealthComponent::Heal(float Amount)
{
	if (!IsAlive() || Amount <= 0.f)
	{
		return 0.f;
	}

	const float Scaled = Amount * HealingMultiplier;
	const float ActualHeal = FMath::Min(Scaled, MaxHealth - CurrentHealth);
	if (ActualHeal <= 0.f)
	{
		return 0.f;
	}

	CurrentHealth += ActualHeal;
	OnHealthChanged.Broadcast(CurrentHealth, MaxHealth);
	return ActualHeal;
}

void UAV_HealthComponent::InitVitals(float InMaxHealth, float InMaxPoise)
{
	MaxHealth = FMath::Max(1.f, InMaxHealth);
	MaxPoise = InMaxPoise;
	BaseMaxPoise = InMaxPoise;
	CurrentHealth = MaxHealth;
	CurrentPoise = MaxPoise;
}

void UAV_HealthComponent::SetMaxPoiseBonus(float Bonus)
{
	if (BaseMaxPoise < 0.f)
	{
		BaseMaxPoise = MaxPoise;
	}
	MaxPoise = BaseMaxPoise + FMath::Max(0.f, Bonus);
	CurrentPoise = FMath::Min(CurrentPoise + FMath::Max(0.f, Bonus), MaxPoise);
}

void UAV_HealthComponent::ResetVitals()
{
	CurrentHealth = MaxHealth;
	CurrentPoise = MaxPoise;
	bInvulnerable = false;
	OnHealthChanged.Broadcast(CurrentHealth, MaxHealth);
}

void UAV_HealthComponent::HandlePoiseDamage(float PoiseDamage)
{
	if (MaxPoise <= 0.f || PoiseDamage <= 0.f)
	{
		return;
	}

	CurrentPoise -= PoiseDamage;

	if (const UWorld* World = GetWorld())
	{
		GetWorld()->GetTimerManager().SetTimer(
			PoiseResetTimer, this, &UAV_HealthComponent::ResetPoise, PoiseResetDelay, false);
	}

	if (CurrentPoise <= 0.f)
	{
		CurrentPoise = MaxPoise;
		OnPoiseBroken.Broadcast();
	}
}

void UAV_HealthComponent::ResetPoise()
{
	CurrentPoise = MaxPoise;
}

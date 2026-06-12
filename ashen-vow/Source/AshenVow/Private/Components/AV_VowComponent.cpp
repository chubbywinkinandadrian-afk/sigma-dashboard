#include "Components/AV_VowComponent.h"
#include "Components/AV_HealthComponent.h"
#include "Components/AV_StaminaComponent.h"
#include "Vow/AV_VowDataAsset.h"
#include "Engine/OverlapResult.h"
#include "Engine/World.h"

UAV_VowComponent::UAV_VowComponent()
{
	PrimaryComponentTick.bCanEverTick = true;

	// ---- Vow of Ash: risky low-health damage build ----
	FAV_VowDefinition Ash;
	Ash.VowId = FName("VowOfAsh");
	Ash.DisplayName = NSLOCTEXT("AshenVow", "VowOfAsh", "Vow of Ash");
	Ash.Description = NSLOCTEXT("AshenVow", "VowOfAshDesc",
		"Burn brighter as you gutter. +25% damage below 35% health, but healing is reduced by 25%.");
	Ash.LowHealthDamageBonus = 0.25f;
	Ash.LowHealthThreshold = 0.35f;
	Ash.HealingMultiplier = 0.75f;
	Ash.bHasAbility = true;
	Ash.AbilityName = NSLOCTEXT("AshenVow", "AshBurst", "Ash Burst");
	Ash.AbilityEnergyCost = 40.f;
	Ash.AbilityCooldown = 8.f;
	Ash.AbilityDamage = 30.f;
	Ash.AbilityPoiseDamage = 40.f;
	Ash.AbilityRadius = 350.f;

	// ---- Vow of Iron: tanky knight build ----
	FAV_VowDefinition Iron;
	Iron.VowId = FName("VowOfIron");
	Iron.DisplayName = NSLOCTEXT("AshenVow", "VowOfIron", "Vow of Iron");
	Iron.Description = NSLOCTEXT("AshenVow", "VowOfIronDesc",
		"Stand as the walls once stood. Take 20% less damage and resist stagger, but stamina returns 30% slower.");
	Iron.IncomingDamageMultiplier = 0.8f;
	Iron.BonusMaxPoise = 30.f;
	Iron.StaminaRegenMultiplier = 0.7f;

	// ---- Vow of Silence: agile assassin build ----
	FAV_VowDefinition Silence;
	Silence.VowId = FName("VowOfSilence");
	Silence.DisplayName = NSLOCTEXT("AshenVow", "VowOfSilence", "Vow of Silence");
	Silence.Description = NSLOCTEXT("AshenVow", "VowOfSilenceDesc",
		"Move as the forgotten move. Dodging costs 35% less stamina and critical strikes cut deeper, but Vow Energy gathers slowly.");
	Silence.DodgeStaminaCostMultiplier = 0.65f;
	Silence.CriticalDamageMultiplier = 1.5f;
	Silence.VowEnergyRegenMultiplier = 0.6f;

	BuiltInVows = { Ash, Iron, Silence };
}

void UAV_VowComponent::BeginPlay()
{
	Super::BeginPlay();

	OwnerHealth = GetOwner()->FindComponentByClass<UAV_HealthComponent>();
	OwnerStamina = GetOwner()->FindComponentByClass<UAV_StaminaComponent>();

	OnVowEnergyChanged.Broadcast(CurrentVowEnergy, MaxVowEnergy);
}

void UAV_VowComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	const float RegenMult = EquippedVow.IsValid() ? EquippedVow.VowEnergyRegenMultiplier : 1.f;
	if (CurrentVowEnergy < MaxVowEnergy && EnergyRegenPerSecond > 0.f)
	{
		CurrentVowEnergy = FMath::Min(MaxVowEnergy, CurrentVowEnergy + EnergyRegenPerSecond * RegenMult * DeltaTime);
		OnVowEnergyChanged.Broadcast(CurrentVowEnergy, MaxVowEnergy);
	}
}

// ---------------- Unlock / equip ----------------

bool UAV_VowComponent::GrantVow(FName VowId)
{
	FAV_VowDefinition Definition;
	if (!FindVowDefinition(VowId, Definition) || UnlockedVowIds.Contains(VowId))
	{
		return false;
	}

	UnlockedVowIds.Add(VowId);
	OnVowUnlocked.Broadcast(Definition);

	if (!EquippedVow.IsValid())
	{
		EquipVow(VowId); // first fragment binds itself — the Vowless makes their first promise
	}
	return true;
}

bool UAV_VowComponent::EquipVow(FName VowId)
{
	FAV_VowDefinition Definition;
	if (!UnlockedVowIds.Contains(VowId) || !FindVowDefinition(VowId, Definition))
	{
		return false;
	}

	RemoveEquippedVowEffects();
	EquippedVow = Definition;
	ApplyEquippedVowEffects();

	OnVowEquipped.Broadcast(EquippedVow);
	return true;
}

void UAV_VowComponent::UnequipVow()
{
	if (!EquippedVow.IsValid())
	{
		return;
	}
	RemoveEquippedVowEffects();
	EquippedVow = FAV_VowDefinition();
	OnVowUnequipped.Broadcast();
}

FText UAV_VowComponent::GetEquippedVowDisplayName() const
{
	return EquippedVow.IsValid()
		? EquippedVow.DisplayName
		: NSLOCTEXT("AshenVow", "Vowless", "Vowless");
}

TArray<FAV_VowDefinition> UAV_VowComponent::GetUnlockedVowDefinitions() const
{
	TArray<FAV_VowDefinition> Result;
	for (const FName& VowId : UnlockedVowIds)
	{
		FAV_VowDefinition Definition;
		if (FindVowDefinition(VowId, Definition))
		{
			Result.Add(Definition);
		}
	}
	return Result;
}

bool UAV_VowComponent::FindVowDefinition(FName VowId, FAV_VowDefinition& OutDefinition) const
{
	for (const FAV_VowDefinition& Vow : BuiltInVows)
	{
		if (Vow.VowId == VowId)
		{
			OutDefinition = Vow;
			return true;
		}
	}
	for (const UAV_VowDataAsset* Asset : ExtraVowAssets)
	{
		if (Asset && Asset->Definition.VowId == VowId)
		{
			OutDefinition = Asset->Definition;
			return true;
		}
	}
	return false;
}

// ---------------- Stat application ----------------

void UAV_VowComponent::ApplyEquippedVowEffects()
{
	if (!EquippedVow.IsValid())
	{
		return;
	}
	if (OwnerHealth)
	{
		OwnerHealth->SetHealingMultiplier(EquippedVow.HealingMultiplier);
		OwnerHealth->SetIncomingDamageMultiplier(EquippedVow.IncomingDamageMultiplier);
		OwnerHealth->SetMaxPoiseBonus(EquippedVow.BonusMaxPoise);
	}
	if (OwnerStamina)
	{
		OwnerStamina->SetRegenMultiplier(EquippedVow.StaminaRegenMultiplier);
	}
}

void UAV_VowComponent::RemoveEquippedVowEffects()
{
	if (OwnerHealth)
	{
		OwnerHealth->SetHealingMultiplier(1.f);
		OwnerHealth->SetIncomingDamageMultiplier(1.f);
		OwnerHealth->SetMaxPoiseBonus(0.f);
	}
	if (OwnerStamina)
	{
		OwnerStamina->SetRegenMultiplier(1.f);
	}
}

float UAV_VowComponent::GetOutgoingDamageMultiplier() const
{
	if (!EquippedVow.IsValid())
	{
		return 1.f;
	}

	float Multiplier = EquippedVow.OutgoingDamageMultiplier;
	if (EquippedVow.LowHealthDamageBonus > 0.f && OwnerHealth &&
		OwnerHealth->GetHealthPercent() <= EquippedVow.LowHealthThreshold)
	{
		Multiplier *= 1.f + EquippedVow.LowHealthDamageBonus;
	}
	return Multiplier;
}

float UAV_VowComponent::GetDodgeStaminaCostMultiplier() const
{
	return EquippedVow.IsValid() ? EquippedVow.DodgeStaminaCostMultiplier : 1.f;
}

// ---------------- Vow Energy ----------------

void UAV_VowComponent::GainEnergy(float Amount)
{
	if (Amount <= 0.f)
	{
		return;
	}
	CurrentVowEnergy = FMath::Min(MaxVowEnergy, CurrentVowEnergy + Amount);
	OnVowEnergyChanged.Broadcast(CurrentVowEnergy, MaxVowEnergy);
}

void UAV_VowComponent::RestoreFullEnergy()
{
	CurrentVowEnergy = MaxVowEnergy;
	OnVowEnergyChanged.Broadcast(CurrentVowEnergy, MaxVowEnergy);
}

// ---------------- Ability ----------------

bool UAV_VowComponent::TryActivateAbility()
{
	if (!EquippedVow.IsValid() || !EquippedVow.bHasAbility)
	{
		return false;
	}
	if (CurrentVowEnergy < EquippedVow.AbilityEnergyCost || GetAbilityCooldownRemaining() > 0.f)
	{
		return false;
	}

	CurrentVowEnergy -= EquippedVow.AbilityEnergyCost;
	LastAbilityTime = GetWorld()->GetTimeSeconds();
	OnVowEnergyChanged.Broadcast(CurrentVowEnergy, MaxVowEnergy);

	PerformAbilityBurst(EquippedVow);
	OnVowAbilityActivated.Broadcast(EquippedVow);
	return true;
}

float UAV_VowComponent::GetAbilityCooldownRemaining() const
{
	if (!EquippedVow.IsValid() || !EquippedVow.bHasAbility || !GetWorld())
	{
		return 0.f;
	}
	const float Elapsed = GetWorld()->GetTimeSeconds() - LastAbilityTime;
	return FMath::Max(0.f, EquippedVow.AbilityCooldown - Elapsed);
}

void UAV_VowComponent::PerformAbilityBurst(const FAV_VowDefinition& Vow)
{
	AActor* Owner = GetOwner();
	UWorld* World = GetWorld();
	if (!Owner || !World)
	{
		return;
	}

	TArray<FOverlapResult> Overlaps;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(AVVowBurst), false, Owner);
	World->OverlapMultiByObjectType(
		Overlaps, Owner->GetActorLocation(), FQuat::Identity,
		FCollisionObjectQueryParams(ECC_Pawn),
		FCollisionShape::MakeSphere(Vow.AbilityRadius), Params);

	TSet<AActor*> Damaged;
	for (const FOverlapResult& Overlap : Overlaps)
	{
		AActor* HitActor = Overlap.GetActor();
		if (!HitActor || HitActor == Owner || Damaged.Contains(HitActor) ||
			!HitActor->ActorHasTag(AbilityTargetTag))
		{
			continue;
		}

		UAV_HealthComponent* VictimHealth = HitActor->FindComponentByClass<UAV_HealthComponent>();
		if (!VictimHealth || !VictimHealth->IsAlive())
		{
			continue;
		}

		Damaged.Add(HitActor);

		FAV_DamageInfo DamageInfo;
		DamageInfo.Amount = Vow.AbilityDamage * GetOutgoingDamageMultiplier();
		DamageInfo.PoiseDamage = Vow.AbilityPoiseDamage;
		DamageInfo.InstigatorActor = Owner;
		DamageInfo.HitLocation = HitActor->GetActorLocation();
		VictimHealth->ApplyDamage(DamageInfo);
	}
}

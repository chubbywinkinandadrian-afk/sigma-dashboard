#include "Components/AV_StaminaComponent.h"

UAV_StaminaComponent::UAV_StaminaComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

void UAV_StaminaComponent::BeginPlay()
{
	Super::BeginPlay();
	CurrentStamina = MaxStamina;
	TimeSinceLastSpend = RegenDelay;
	OnStaminaChanged.Broadcast(CurrentStamina, MaxStamina);
}

void UAV_StaminaComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	TimeSinceLastSpend += DeltaTime;

	if (TimeSinceLastSpend >= RegenDelay && CurrentStamina < MaxStamina)
	{
		CurrentStamina = FMath::Min(MaxStamina, CurrentStamina + RegenRate * RegenMultiplier * DeltaTime);
		OnStaminaChanged.Broadcast(CurrentStamina, MaxStamina);
	}
}

bool UAV_StaminaComponent::CanAfford(float Cost) const
{
	if (Cost <= 0.f)
	{
		return true;
	}
	return bAllowActionWithAnyStamina ? CurrentStamina > 0.f : CurrentStamina >= Cost;
}

bool UAV_StaminaComponent::Consume(float Cost)
{
	if (!CanAfford(Cost))
	{
		return false;
	}
	SpendInternal(Cost);
	return true;
}

void UAV_StaminaComponent::Drain(float Amount)
{
	if (Amount <= 0.f || CurrentStamina <= 0.f)
	{
		return;
	}
	SpendInternal(Amount);
}

void UAV_StaminaComponent::RestoreFull()
{
	CurrentStamina = MaxStamina;
	OnStaminaChanged.Broadcast(CurrentStamina, MaxStamina);
}

void UAV_StaminaComponent::SpendInternal(float Amount)
{
	const float OldStamina = CurrentStamina;
	CurrentStamina = FMath::Max(0.f, CurrentStamina - Amount);
	TimeSinceLastSpend = 0.f;

	OnStaminaChanged.Broadcast(CurrentStamina, MaxStamina);

	if (OldStamina > 0.f && CurrentStamina <= 0.f)
	{
		OnStaminaDepleted.Broadcast();
	}
}

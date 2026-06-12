#include "UI/AV_HUDWidget.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Components/AV_HealthComponent.h"
#include "Components/AV_StaminaComponent.h"
#include "Components/AV_LockOnComponent.h"
#include "Components/AV_InteractionComponent.h"
#include "Interfaces/AV_Targetable.h"
#include "Kismet/GameplayStatics.h"

AAV_PlayerCharacter* UAV_HUDWidget::GetPlayer() const
{
	return Cast<AAV_PlayerCharacter>(GetOwningPlayerPawn());
}

float UAV_HUDWidget::GetHealthPercent() const
{
	const AAV_PlayerCharacter* Player = GetPlayer();
	return Player ? Player->GetHealthComponent()->GetHealthPercent() : 0.f;
}

float UAV_HUDWidget::GetStaminaPercent() const
{
	const AAV_PlayerCharacter* Player = GetPlayer();
	return Player ? Player->GetStaminaComponent()->GetStaminaPercent() : 0.f;
}

int32 UAV_HUDWidget::GetFlaskCharges() const
{
	const AAV_PlayerCharacter* Player = GetPlayer();
	return Player ? Player->GetFlaskCharges() : 0;
}

int32 UAV_HUDWidget::GetMaxFlaskCharges() const
{
	const AAV_PlayerCharacter* Player = GetPlayer();
	return Player ? Player->GetMaxFlaskCharges() : 0;
}

int32 UAV_HUDWidget::GetAshCount() const
{
	const AAV_PlayerCharacter* Player = GetPlayer();
	return Player ? Player->GetAshCount() : 0;
}

FText UAV_HUDWidget::GetInteractionPrompt() const
{
	const AAV_PlayerCharacter* Player = GetPlayer();
	return Player ? Player->GetInteractionComponent()->GetFocusedPromptText() : FText::GetEmpty();
}

bool UAV_HUDWidget::IsLockedOn() const
{
	const AAV_PlayerCharacter* Player = GetPlayer();
	return Player && Player->GetLockOnComponent()->IsLockedOn();
}

bool UAV_HUDWidget::GetLockOnScreenPosition(FVector2D& OutScreenPosition) const
{
	OutScreenPosition = FVector2D::ZeroVector;

	const AAV_PlayerCharacter* Player = GetPlayer();
	AActor* Target = Player ? Player->GetLockOnComponent()->GetCurrentTarget() : nullptr;
	if (!Target || !Target->Implements<UAV_Targetable>())
	{
		return false;
	}

	const FVector WorldPoint = IAV_Targetable::Execute_GetTargetPoint(Target);
	return UGameplayStatics::ProjectWorldToScreen(GetOwningPlayer(), WorldPoint, OutScreenPosition);
}

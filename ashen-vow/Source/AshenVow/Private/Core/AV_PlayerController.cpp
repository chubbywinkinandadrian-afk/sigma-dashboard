#include "Core/AV_PlayerController.h"
#include "UI/AV_HUDWidget.h"
#include "Blueprint/UserWidget.h"

void AAV_PlayerController::BeginPlay()
{
	Super::BeginPlay();

	SetInputMode(FInputModeGameOnly());
	bShowMouseCursor = false;

	if (HUDWidgetClass)
	{
		HUDWidget = CreateWidget<UAV_HUDWidget>(this, HUDWidgetClass);
		if (HUDWidget)
		{
			HUDWidget->AddToViewport(0);
		}
	}
}

void AAV_PlayerController::ShowDeathScreen()
{
	if (!DeathScreenWidget && DeathScreenClass)
	{
		DeathScreenWidget = CreateWidget<UUserWidget>(this, DeathScreenClass);
	}
	if (DeathScreenWidget && !DeathScreenWidget->IsInViewport())
	{
		DeathScreenWidget->AddToViewport(10);
	}
}

void AAV_PlayerController::HideDeathScreen()
{
	if (DeathScreenWidget && DeathScreenWidget->IsInViewport())
	{
		DeathScreenWidget->RemoveFromParent();
	}
}

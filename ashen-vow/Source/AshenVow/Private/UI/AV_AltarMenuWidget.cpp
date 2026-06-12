#include "UI/AV_AltarMenuWidget.h"
#include "Core/AV_PlayerController.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Components/AV_VowComponent.h"
#include "World/AV_AshenAltar.h"

void UAV_AltarMenuWidget::SelectRest()
{
	AAV_PlayerController* PC = Cast<AAV_PlayerController>(GetOwningPlayer());
	AAV_AshenAltar* Altar = PC ? PC->GetMenuAltar() : nullptr;
	if (Altar && PC->GetPawn())
	{
		Altar->PerformRest(PC->GetPawn());
		OnMenuChangedBP();
	}
}

void UAV_AltarMenuWidget::SelectVow(FName VowId)
{
	const AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(GetOwningPlayerPawn());
	if (Player && Player->GetVowComponent()->EquipVow(VowId))
	{
		OnMenuChangedBP();
	}
}

void UAV_AltarMenuWidget::LeaveMenu()
{
	if (AAV_PlayerController* PC = Cast<AAV_PlayerController>(GetOwningPlayer()))
	{
		PC->CloseAltarMenu();
	}
}

TArray<FAV_VowDefinition> UAV_AltarMenuWidget::GetUnlockedVows() const
{
	const AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(GetOwningPlayerPawn());
	return Player ? Player->GetVowComponent()->GetUnlockedVowDefinitions() : TArray<FAV_VowDefinition>();
}

FName UAV_AltarMenuWidget::GetEquippedVowId() const
{
	const AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(GetOwningPlayerPawn());
	return Player && Player->GetVowComponent()->HasVowEquipped()
		? Player->GetVowComponent()->GetEquippedVow().VowId
		: NAME_None;
}
